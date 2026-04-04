const Claim = require('../models/Claim');
const Policy = require('../models/Policy');
const mongoose = require('mongoose');
const { checkFraud } = require('../services/fraudService');
const { buildTransition } = require('../services/settlementService');
const { checkExclusion, evaluateTrigger } = require('../services/triggerService');
const {
  REASON_CODES,
  SETTLEMENT_STATUS,
} = require('../constants/decisionContract');
const { fetchRainfallMm } = require('../services/weatherService');

const resolveActivePolicy = async (policyRef, userId) => {
  const policyLookup = String(policyRef || '').trim();
  if (!policyLookup) return null;

  const baseFilter = { userId, status: 'active' };

  if (mongoose.Types.ObjectId.isValid(policyLookup)) {
    const policyById = await Policy.findOne({ ...baseFilter, _id: policyLookup });
    if (policyById) return policyById;
  }

  return Policy.findOne({ ...baseFilter, policyNumber: policyLookup });
};

/**
 * POST /api/claims
 * File a new claim against an active policy.
 * Body: { policyId, triggerType, triggerValue, documents? }
 *
 * Fraud check is triggered asynchronously so the worker gets an immediate response.
 */
exports.createClaim = async (req, res) => {
  try {
    const {
      policyId,
      triggerType,
      triggerValue,
      documents,
      exclusionCode,
      eventCategory,
      weatherLookup,
    } = req.body;

    if (!policyId || !triggerType) {
      return res.status(400).json({
        success: false,
        message: 'policyId and triggerType are required',
      });
    }

    let observedTriggerValue = triggerValue;
    let weatherObservation = null;

    if (
      observedTriggerValue == null
      && triggerType === 'rainfall'
      && weatherLookup?.latitude != null
      && weatherLookup?.longitude != null
    ) {
      weatherObservation = await fetchRainfallMm({
        latitude: weatherLookup.latitude,
        longitude: weatherLookup.longitude,
        observedAt: weatherLookup.observedAt,
      });
      observedTriggerValue = weatherObservation.rainfallMm;
    }

    if (observedTriggerValue == null) {
      return res.status(400).json({
        success: false,
        message: 'triggerValue is required unless rainfall weather lookup is provided',
      });
    }

    // Confirm the policy belongs to this worker and is active
    const policy = await resolveActivePolicy(policyId, req.user.id);
    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Active policy not found. Use policy ID or policy number from dashboard.',
      });
    }

    if (new Date() > policy.endDate) {
      return res.status(400).json({ success: false, message: 'Policy has expired' });
    }

    const exclusion = checkExclusion(policy, { exclusionCode, eventCategory });
    if (exclusion.hit) {
      return res.status(422).json({
        success: false,
        message: exclusion.reasonDetail,
        verdict: 'hard_block',
        reasonCode: exclusion.reasonCode,
        reasonDetail: exclusion.reasonDetail,
        settlementStatus: SETTLEMENT_STATUS.HARD_BLOCK,
        payoutEligibility: false,
      });
    }

    const triggerEvaluation = evaluateTrigger(policy, triggerType, Number(observedTriggerValue));
    if (!triggerEvaluation.triggered) {
      return res.status(422).json({
        success: false,
        message: triggerEvaluation.reasonDetail,
        verdict: 'auto_approve',
        reasonCode: triggerEvaluation.reasonCode,
        reasonDetail: triggerEvaluation.reasonDetail,
        settlementStatus: SETTLEMENT_STATUS.PENDING,
        payoutEligibility: false,
      });
    }

    const claimAmount = Number((policy.coverageAmount || 0) * Number(triggerEvaluation.payoutRatio));

    const claim = await Claim.create({
      policyId: policy._id,
      userId: req.user.id,
      triggerType,
      triggerValue: Number(observedTriggerValue),
      claimAmount,
      documents: documents || [],
      status: 'pending',
      settlementStatus: SETTLEMENT_STATUS.PENDING,
      reasonCode: REASON_CODES.CLAIM_FILED,
      reasonDetail: 'Claim submitted and queued for fraud evaluation',
      payoutEligibility: false,
      evaluationMeta: {
        source: 'claim_create',
        timestamp: new Date().toISOString(),
        trigger: {
          threshold: triggerEvaluation.threshold,
          observed: triggerEvaluation.observed,
          payoutRatio: triggerEvaluation.payoutRatio,
        },
        ...(weatherObservation
          ? {
            weatherObservation: {
              source: weatherObservation.source,
              observedDate: weatherObservation.observedDate,
              latitude: weatherObservation.latitude,
              longitude: weatherObservation.longitude,
              rainfallMm: weatherObservation.rainfallMm,
            },
          }
          : {}),
      },
    });

    // Kick off async fraud assessment — does not block the HTTP response
    checkFraud(claim._id.toString()).catch((e) =>
      console.error(`Async fraud check failed for claim ${claim._id}:`, e.message),
    );

    res.status(201).json({ success: true, claim });
  } catch (err) {
    console.error('createClaim error:', err);
    res.status(500).json({ success: false, message: 'Failed to file claim' });
  }
};

/**
 * GET /api/claims
 * List all claims for the authenticated worker.
 */
exports.getClaims = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { userId: req.user.id };
    if (status) filter.status = status;

    const claims = await Claim.find(filter)
      .populate('policyId', 'policyNumber type coverageAmount platform')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, claims });
  } catch (err) {
    console.error('getClaims error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch claims' });
  }
};

/**
 * GET /api/claims/:id
 */
exports.getClaim = async (req, res) => {
  try {
    const claim = await Claim.findOne({ _id: req.params.id, userId: req.user.id })
      .populate('policyId', 'policyNumber type coverageAmount triggers platform')
      .lean();

    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }
    res.json({ success: true, claim });
  } catch (err) {
    console.error('getClaim error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch claim' });
  }
};

/**
 * PATCH /api/claims/:id/approve  [admin only]
 * Approve a claim and set the approved payout amount.
 * Body: { approvedAmount, remarks? }
 */
exports.approveClaim = async (req, res) => {
  try {
    const { approvedAmount, remarks } = req.body;

    if (approvedAmount == null || approvedAmount < 0) {
      return res.status(400).json({ success: false, message: 'A valid approvedAmount is required' });
    }

    const existingClaim = await Claim.findById(req.params.id);
    if (!existingClaim) return res.status(404).json({ success: false, message: 'Claim not found' });

    const transition = buildTransition({
      currentStatus: existingClaim.settlementStatus || SETTLEMENT_STATUS.PENDING,
      targetStatus: SETTLEMENT_STATUS.APPROVED,
      reasonCode: REASON_CODES.MANUAL_APPROVAL,
      reasonDetail: remarks || 'Manually approved by admin',
      evaluationMeta: {
        source: 'manual_approval',
        timestamp: new Date().toISOString(),
      },
    });

    if (!transition.ok) {
      return res.status(409).json({ success: false, ...transition.error });
    }

    const claim = await Claim.findByIdAndUpdate(
      req.params.id,
      {
        approvedAmount: Number(approvedAmount),
        remarks,
        ...transition.patch,
      },
      { new: true },
    );

    res.json({ success: true, claim });
  } catch (err) {
    console.error('approveClaim error:', err);
    res.status(500).json({ success: false, message: 'Failed to approve claim' });
  }
};

/**
 * PATCH /api/claims/:id/reject  [admin only]
 * Reject a claim with a reason.
 */
exports.rejectClaim = async (req, res) => {
  try {
    const { remarks } = req.body;

    const existingClaim = await Claim.findById(req.params.id);
    if (!existingClaim) return res.status(404).json({ success: false, message: 'Claim not found' });

    const transition = buildTransition({
      currentStatus: existingClaim.settlementStatus || SETTLEMENT_STATUS.PENDING,
      targetStatus: SETTLEMENT_STATUS.HARD_BLOCK,
      reasonCode: REASON_CODES.MANUAL_REJECTION,
      reasonDetail: remarks || 'Manually rejected by admin',
      evaluationMeta: {
        source: 'manual_rejection',
        timestamp: new Date().toISOString(),
      },
    });

    if (!transition.ok) {
      return res.status(409).json({ success: false, ...transition.error });
    }

    const claim = await Claim.findByIdAndUpdate(
      req.params.id,
      { remarks, ...transition.patch },
      { new: true },
    );
    res.json({ success: true, claim });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reject claim' });
  }
};

/**
 * PATCH /api/claims/:id/paid [admin only]
 * Team 2 payout orchestration callback after transfer success.
 * Body: { payoutReference, remarks?, paidAmount? }
 */
exports.markClaimPaid = async (req, res) => {
  try {
    const { payoutReference, remarks, paidAmount } = req.body;

    if (!payoutReference) {
      return res.status(400).json({ success: false, message: 'payoutReference is required' });
    }

    const existingClaim = await Claim.findById(req.params.id);
    if (!existingClaim) return res.status(404).json({ success: false, message: 'Claim not found' });

    const transition = buildTransition({
      currentStatus: existingClaim.settlementStatus || SETTLEMENT_STATUS.PENDING,
      targetStatus: SETTLEMENT_STATUS.PAID,
      reasonCode: REASON_CODES.PAYOUT_SETTLED,
      reasonDetail: remarks || `Payout settled with reference ${payoutReference}`,
      evaluationMeta: {
        source: 'team2_payout_orchestrator',
        payoutReference,
        timestamp: new Date().toISOString(),
      },
    });

    if (!transition.ok) {
      return res.status(409).json({ success: false, ...transition.error });
    }

    const claim = await Claim.findByIdAndUpdate(
      req.params.id,
      {
        approvedAmount: Number(paidAmount ?? existingClaim.approvedAmount ?? existingClaim.claimAmount ?? 0),
        remarks: remarks || `Payout transferred (${payoutReference})`,
        ...transition.patch,
      },
      { new: true },
    );

    return res.json({ success: true, claim });
  } catch (err) {
    console.error('markClaimPaid error:', err);
    return res.status(500).json({ success: false, message: 'Failed to mark claim as paid' });
  }
};
