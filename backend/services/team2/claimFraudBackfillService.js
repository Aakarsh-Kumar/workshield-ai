const Claim = require('../../models/Claim');
const { checkFraud } = require('../fraudService');
const { SETTLEMENT_STATUS } = require('../../constants/decisionContract');

const normalizeStatuses = (settlementStatuses = []) => {
  const requested = Array.isArray(settlementStatuses) ? settlementStatuses : [settlementStatuses];
  const allowed = new Set([
    SETTLEMENT_STATUS.PENDING,
    SETTLEMENT_STATUS.SOFT_FLAG,
    SETTLEMENT_STATUS.HARD_BLOCK,
    SETTLEMENT_STATUS.APPROVED,
  ]);
  const filtered = requested
    .map((value) => String(value || '').trim())
    .filter((value) => allowed.has(value));

  return filtered.length > 0 ? filtered : [SETTLEMENT_STATUS.PENDING];
};

const runClaimFraudBackfill = async ({
  limit = 50,
  settlementStatuses,
  unscoredOnly = true,
  olderThanHours = 0,
} = {}) => {
  const normalizedStatuses = normalizeStatuses(settlementStatuses);
  const claims = await Claim.find({
    settlementStatus: { $in: normalizedStatuses },
    ...(Number(olderThanHours) > 0
      ? { createdAt: { $lte: new Date(Date.now() - Number(olderThanHours) * 60 * 60 * 1000) } }
      : {}),
    ...(unscoredOnly
      ? {
        $or: [
          { fraudModelVersion: { $exists: false } },
          { fraudModelVersion: null },
          { fraudModelVersion: '' },
        ],
      }
      : {}),
  })
    .sort({ createdAt: 1 })
    .limit(Math.max(1, Math.min(Number(limit) || 50, 200)))
    .lean();

  const results = [];

  for (const claim of claims) {
    try {
      const requiresManualReview = Boolean(claim?.evaluationMeta?.verification?.requiresManualReview);
      const allowAutoApprove = claim.settlementStatus === SETTLEMENT_STATUS.PENDING && !requiresManualReview;
      const fraud = await checkFraud(claim._id.toString(), {
        allowAutoApprove,
        preservePendingReason: requiresManualReview,
      });

      results.push({
        claimId: claim._id.toString(),
        status: 'rescored',
        settlementStatus: claim.settlementStatus,
        fraudScore: fraud.fraudScore,
        verdict: fraud.verdict,
      });
    } catch (error) {
      results.push({
        claimId: claim._id.toString(),
        status: 'error',
        message: error.message,
      });
    }
  }

  return {
    requestedStatuses: normalizedStatuses,
    scanned: claims.length,
    rescored: results.filter((row) => row.status === 'rescored').length,
    errors: results.filter((row) => row.status === 'error').length,
    results,
  };
};

module.exports = {
  runClaimFraudBackfill,
};
