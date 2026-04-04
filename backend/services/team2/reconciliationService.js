const PayoutAttempt = require('../../models/PayoutAttempt');
const { PAYOUT_ATTEMPT_STATUS } = require('../../constants/team2Payout');
const { sendOpsAlert } = require('./alertService');

const STALE_PROVIDER_SUCCESS_MINUTES = Number(process.env.TEAM2_STALE_PROVIDER_SUCCESS_MINUTES || 15);

const runDailyReconciliation = async ({ emitAlert = true } = {}) => {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - STALE_PROVIDER_SUCCESS_MINUTES * 60 * 1000);
  const dayCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [staleProviderSuccess, retryOverdue, conflictCount, failedTerminal24h] = await Promise.all([
    PayoutAttempt.countDocuments({
      status: PAYOUT_ATTEMPT_STATUS.PROVIDER_SUCCESS,
      updatedAt: { $lt: staleCutoff },
    }),
    PayoutAttempt.countDocuments({
      status: PAYOUT_ATTEMPT_STATUS.RETRY_SCHEDULED,
      nextRetryAt: { $lte: now },
    }),
    PayoutAttempt.countDocuments({ status: PAYOUT_ATTEMPT_STATUS.CONFLICT }),
    PayoutAttempt.countDocuments({
      status: PAYOUT_ATTEMPT_STATUS.FAILED_TERMINAL,
      updatedAt: { $gte: dayCutoff },
    }),
  ]);

  const summary = {
    generatedAt: now.toISOString(),
    staleProviderSuccess,
    retryOverdue,
    conflictCount,
    failedTerminal24h,
  };

  const needsAlert = staleProviderSuccess > 0 || retryOverdue > 0 || conflictCount > 0;
  if (emitAlert && needsAlert) {
    await sendOpsAlert({
      key: 'daily_reconciliation_attention',
      severity: 'warning',
      message: 'Team2 reconciliation detected payout workflow exceptions',
      payload: summary,
    });
  }

  return summary;
};

module.exports = {
  runDailyReconciliation,
};
