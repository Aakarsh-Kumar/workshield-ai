const Claim = require('../../models/Claim');
const PayoutAttempt = require('../../models/PayoutAttempt');
const ManualReviewAction = require('../../models/ManualReviewAction');
const { enrichClaimRecord } = require('../claimLifecycleService');

const getAdminClaimDetail = async (claimId) => {
  const claim = await Claim.findById(claimId)
    .populate('policyId', 'policyNumber type coverageAmount platform triggers')
    .populate('userId', 'name email platform weeklyDeliveries')
    .lean();

  if (!claim) {
    return null;
  }

  const [payoutAttempt, manualReviewActions] = await Promise.all([
    PayoutAttempt.findOne({ claimId }).lean(),
    ManualReviewAction.find({ claimId })
      .sort({ createdAt: -1 })
      .populate('actorUserId', 'name email')
      .lean(),
  ]);

  return {
    claim: enrichClaimRecord(claim),
    payoutAttempt: payoutAttempt
      ? {
        ...payoutAttempt,
        timeline: Array.isArray(payoutAttempt.timeline)
          ? [...payoutAttempt.timeline].sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
          : [],
      }
      : null,
    manualReviewActions: manualReviewActions.map((action) => ({
      ...action,
      actorUserLabel: action.actorUserId?.name || action.actorUserId?.email || 'Admin reviewer',
    })),
  };
};

module.exports = {
  getAdminClaimDetail,
};
