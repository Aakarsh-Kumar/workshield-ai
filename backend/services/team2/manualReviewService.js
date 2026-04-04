const Claim = require('../../models/Claim');
const ManualReviewAction = require('../../models/ManualReviewAction');
const {
  REASON_CODES,
  SETTLEMENT_STATUS,
} = require('../../constants/decisionContract');
const { buildTransition } = require('../settlementService');

const listManualReviewQueue = async ({ limit = 50 } = {}) => {
  return Claim.find({ settlementStatus: SETTLEMENT_STATUS.SOFT_FLAG })
    .populate('policyId', 'policyNumber coverageAmount platform')
    .sort({ createdAt: 1 })
    .limit(Math.max(1, Math.min(Number(limit) || 50, 200)))
    .lean();
};

const applyManualReviewDecision = async ({ claimId, action, actorUserId, approvedAmount, remarks }) => {
  const claim = await Claim.findById(claimId);
  if (!claim) {
    return { ok: false, status: 404, message: 'Claim not found' };
  }

  const normalizedAction = String(action || '').toLowerCase();
  if (!['approve', 'reject'].includes(normalizedAction)) {
    return { ok: false, status: 400, message: 'action must be approve or reject' };
  }

  const targetStatus = normalizedAction === 'approve' ? SETTLEMENT_STATUS.APPROVED : SETTLEMENT_STATUS.HARD_BLOCK;
  const transition = buildTransition({
    currentStatus: claim.settlementStatus || SETTLEMENT_STATUS.PENDING,
    targetStatus,
    reasonCode: normalizedAction === 'approve' ? REASON_CODES.MANUAL_APPROVAL : REASON_CODES.MANUAL_REJECTION,
    reasonDetail: remarks || (normalizedAction === 'approve' ? 'Manually approved by Team 2 reviewer' : 'Manually rejected by Team 2 reviewer'),
    evaluationMeta: {
      source: 'team2_manual_review',
      actorUserId,
      timestamp: new Date().toISOString(),
    },
  });

  if (!transition.ok) {
    return { ok: false, status: 409, error: transition.error };
  }

  const patch = {
    ...transition.patch,
    remarks: remarks || claim.remarks,
  };

  if (normalizedAction === 'approve') {
    patch.approvedAmount = Number(approvedAmount ?? claim.claimAmount ?? 0);
  }

  const updatedClaim = await Claim.findByIdAndUpdate(claim._id, patch, { new: true });

  await ManualReviewAction.create({
    claimId: claim._id,
    actorUserId,
    action: normalizedAction,
    reason: remarks || '',
    approvedAmount: normalizedAction === 'approve' ? Number(patch.approvedAmount) : undefined,
    snapshot: {
      before: {
        settlementStatus: claim.settlementStatus,
        status: claim.status,
      },
      after: {
        settlementStatus: updatedClaim.settlementStatus,
        status: updatedClaim.status,
      },
      reasonCode: patch.reasonCode,
      reasonDetail: patch.reasonDetail,
    },
  });

  return { ok: true, claim: updatedClaim };
};

module.exports = {
  listManualReviewQueue,
  applyManualReviewDecision,
};
