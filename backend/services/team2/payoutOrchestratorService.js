const Claim = require('../../models/Claim');
const PayoutAttempt = require('../../models/PayoutAttempt');
const {
  REASON_CODES,
  SETTLEMENT_STATUS,
  mapSettlementToWorkflowStatus,
} = require('../../constants/decisionContract');
const { PAYOUT_ATTEMPT_STATUS } = require('../../constants/team2Payout');
const { buildTransition } = require('../settlementService');
const { buildIdempotencyKey, executeTransfer } = require('./payoutProviderAdapter');
const { computeRetryDelayMs, shouldRetry } = require('./payoutRetryPolicy');

const ELIGIBLE_ATTEMPT_STATUSES = new Set([
  PAYOUT_ATTEMPT_STATUS.QUEUED,
  PAYOUT_ATTEMPT_STATUS.RETRY_SCHEDULED,
  PAYOUT_ATTEMPT_STATUS.FAILED_TRANSIENT,
  PAYOUT_ATTEMPT_STATUS.PROVIDER_SUCCESS,
]);

const buildErrorPayload = (code, message, transient, statusCode) => ({
  code,
  message,
  transient,
  statusCode,
  at: new Date().toISOString(),
});

const updateAttemptStatus = async (attemptId, patch, event, detail) => {
  return PayoutAttempt.findByIdAndUpdate(
    attemptId,
    {
      ...patch,
      $push: {
        timeline: {
          event,
          detail,
        },
      },
    },
    { new: true },
  );
};

const ensureAttempt = async (claim) => {
  const idempotencyKey = buildIdempotencyKey(claim._id.toString());

  return PayoutAttempt.findOneAndUpdate(
    { claimId: claim._id },
    {
      $setOnInsert: {
        idempotencyKey,
        status: PAYOUT_ATTEMPT_STATUS.QUEUED,
        attemptCount: 0,
        timeline: [{ event: 'attempt_created', detail: { source: 'team2_orchestrator' } }],
      },
    },
    { new: true, upsert: true },
  );
};

const confirmPaidTransition = async ({ claim, providerReference, providerMode }) => {
  const transition = buildTransition({
    currentStatus: claim.settlementStatus || SETTLEMENT_STATUS.PENDING,
    targetStatus: SETTLEMENT_STATUS.PAID,
    reasonCode: REASON_CODES.PAYOUT_SETTLED,
    reasonDetail: `Payout settled with reference ${providerReference}`,
    evaluationMeta: {
      source: 'team2_payout_orchestrator',
      providerReference,
      providerMode,
      timestamp: new Date().toISOString(),
    },
  });

  if (!transition.ok) {
    return {
      ok: false,
      transient: false,
      error: transition.error,
    };
  }

  const amount = Number(claim.approvedAmount ?? claim.claimAmount ?? 0);
  await Claim.findByIdAndUpdate(claim._id, {
    approvedAmount: amount,
    status: mapSettlementToWorkflowStatus(SETTLEMENT_STATUS.PAID),
    ...transition.patch,
  });

  return { ok: true };
};

const processClaimForPayout = async (claim) => {
  const attempt = await ensureAttempt(claim);

  if (attempt.status === PAYOUT_ATTEMPT_STATUS.CALLBACK_CONFIRMED) {
    return { claimId: claim._id.toString(), state: 'skipped_already_paid' };
  }

  if (!ELIGIBLE_ATTEMPT_STATUSES.has(attempt.status)) {
    return { claimId: claim._id.toString(), state: 'skipped_ineligible_attempt_state' };
  }

  if (attempt.nextRetryAt && attempt.nextRetryAt > new Date()) {
    return { claimId: claim._id.toString(), state: 'deferred_retry_window' };
  }

  const lock = await PayoutAttempt.findOneAndUpdate(
    {
      _id: attempt._id,
      status: { $in: Array.from(ELIGIBLE_ATTEMPT_STATUSES) },
    },
    {
      $set: {
        status: PAYOUT_ATTEMPT_STATUS.PROCESSING,
        lastAttemptAt: new Date(),
        firstAttemptAt: attempt.firstAttemptAt || new Date(),
      },
      $inc: { attemptCount: 1 },
      $push: {
        timeline: {
          event: 'attempt_processing',
          detail: { previousStatus: attempt.status },
        },
      },
    },
    { new: true },
  );

  if (!lock) {
    return { claimId: claim._id.toString(), state: 'skipped_lock_not_acquired' };
  }

  const executeResult = await executeTransfer({
    claimId: claim._id.toString(),
    amount: Number(claim.approvedAmount ?? claim.claimAmount ?? 0),
    attemptCount: lock.attemptCount,
  });

  if (!executeResult.ok) {
    const transient = Boolean(executeResult.transient);
    const retryable = shouldRetry({
      transient,
      attemptCount: lock.attemptCount,
      firstAttemptAt: lock.firstAttemptAt,
    });

    if (retryable) {
      const delayMs = computeRetryDelayMs(lock.attemptCount);
      await updateAttemptStatus(
        lock._id,
        {
          status: PAYOUT_ATTEMPT_STATUS.RETRY_SCHEDULED,
          nextRetryAt: new Date(Date.now() + delayMs),
          lastError: buildErrorPayload(
            executeResult.errorCode || 'PROVIDER_ERROR',
            executeResult.message || 'Provider request failed',
            transient,
            executeResult.statusCode,
          ),
        },
        'attempt_retry_scheduled',
        { delayMs, attemptCount: lock.attemptCount },
      );

      return { claimId: claim._id.toString(), state: 'retry_scheduled' };
    }

    const finalState = transient ? PAYOUT_ATTEMPT_STATUS.FAILED_TRANSIENT : PAYOUT_ATTEMPT_STATUS.FAILED_TERMINAL;
    await updateAttemptStatus(
      lock._id,
      {
        status: finalState,
        nextRetryAt: null,
        lastError: buildErrorPayload(
          executeResult.errorCode || 'PROVIDER_ERROR',
          executeResult.message || 'Provider request failed',
          transient,
          executeResult.statusCode,
        ),
      },
      'attempt_failed',
      { terminal: !transient, attemptCount: lock.attemptCount },
    );

    return { claimId: claim._id.toString(), state: finalState };
  }

  const providerReference = executeResult.providerReference;
  await updateAttemptStatus(
    lock._id,
    {
      status: PAYOUT_ATTEMPT_STATUS.PROVIDER_SUCCESS,
      providerReference,
      providerMode: executeResult.mode,
      providerPayload: executeResult.payload,
      lastError: null,
      nextRetryAt: null,
    },
    'provider_success',
    { providerReference, providerMode: executeResult.mode },
  );

  const latestClaim = await Claim.findById(claim._id);
  if (!latestClaim) {
    await updateAttemptStatus(
      lock._id,
      {
        status: PAYOUT_ATTEMPT_STATUS.CONFLICT,
        lastError: buildErrorPayload('CLAIM_NOT_FOUND', 'Claim was not found after provider success', false, 404),
      },
      'callback_conflict',
      { reason: 'claim_not_found' },
    );

    return { claimId: claim._id.toString(), state: 'conflict' };
  }

  const callback = await confirmPaidTransition({
    claim: latestClaim,
    providerReference,
    providerMode: executeResult.mode,
  });

  if (!callback.ok) {
    await updateAttemptStatus(
      lock._id,
      {
        status: PAYOUT_ATTEMPT_STATUS.CONFLICT,
        lastError: buildErrorPayload(
          callback.error.reasonCode || 'CALLBACK_FAILED',
          callback.error.reasonDetail || 'Failed to mark claim as paid',
          false,
          409,
        ),
      },
      'callback_conflict',
      { reasonCode: callback.error.reasonCode },
    );

    return { claimId: claim._id.toString(), state: 'callback_conflict' };
  }

  await updateAttemptStatus(
    lock._id,
    {
      status: PAYOUT_ATTEMPT_STATUS.CALLBACK_CONFIRMED,
      nextRetryAt: null,
    },
    'callback_confirmed',
    { providerReference },
  );

  return { claimId: claim._id.toString(), state: 'paid' };
};

const runPayoutCycle = async ({ limit = 25 } = {}) => {
  const claims = await Claim.find({
    settlementStatus: SETTLEMENT_STATUS.APPROVED,
    payoutEligibility: true,
  })
    .sort({ createdAt: 1 })
    .limit(Math.max(1, Math.min(Number(limit) || 25, 100)));

  const results = [];
  for (const claim of claims) {
    const result = await processClaimForPayout(claim);
    results.push(result);
  }

  const summary = results.reduce(
    (acc, item) => {
      acc[item.state] = (acc[item.state] || 0) + 1;
      return acc;
    },
    {},
  );

  return {
    scanned: claims.length,
    summary,
    results,
  };
};

module.exports = {
  runPayoutCycle,
};
