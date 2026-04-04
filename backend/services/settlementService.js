const {
  REASON_CODES,
  SETTLEMENT_STATUS,
  mapSettlementToWorkflowStatus,
  isPayoutEligible,
} = require('../constants/decisionContract');

const TRANSITIONS = Object.freeze({
  [SETTLEMENT_STATUS.PENDING]: [
    SETTLEMENT_STATUS.APPROVED,
    SETTLEMENT_STATUS.SOFT_FLAG,
    SETTLEMENT_STATUS.HARD_BLOCK,
  ],
  [SETTLEMENT_STATUS.APPROVED]: [SETTLEMENT_STATUS.PAID],
  [SETTLEMENT_STATUS.SOFT_FLAG]: [SETTLEMENT_STATUS.APPROVED, SETTLEMENT_STATUS.HARD_BLOCK],
  [SETTLEMENT_STATUS.HARD_BLOCK]: [],
  [SETTLEMENT_STATUS.PAID]: [],
});

const canTransition = (fromStatus, toStatus) => {
  const allowed = TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
};

const buildTransition = ({
  currentStatus,
  targetStatus,
  reasonCode,
  reasonDetail,
  evaluationMeta,
}) => {
  if (!canTransition(currentStatus, targetStatus)) {
    return {
      ok: false,
      error: {
        reasonCode: REASON_CODES.INVALID_TRANSITION,
        reasonDetail: `Invalid transition ${currentStatus} -> ${targetStatus}`,
        settlementStatus: currentStatus,
        payoutEligibility: isPayoutEligible(currentStatus),
      },
    };
  }

  return {
    ok: true,
    patch: {
      settlementStatus: targetStatus,
      status: mapSettlementToWorkflowStatus(targetStatus),
      reasonCode,
      reasonDetail,
      payoutEligibility: isPayoutEligible(targetStatus),
      evaluationMeta,
      processedAt: targetStatus === SETTLEMENT_STATUS.SOFT_FLAG ? undefined : new Date(),
    },
  };
};

module.exports = {
  TRANSITIONS,
  canTransition,
  buildTransition,
};
