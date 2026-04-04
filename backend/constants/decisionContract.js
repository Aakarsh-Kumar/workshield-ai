const FRAUD_THRESHOLDS = Object.freeze({
  AUTO_APPROVE_LT: 0.3,
  SOFT_FLAG_LT: 0.7,
});

const VERDICTS = Object.freeze({
  AUTO_APPROVE: 'auto_approve',
  SOFT_FLAG: 'soft_flag',
  HARD_BLOCK: 'hard_block',
});

const SETTLEMENT_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  SOFT_FLAG: 'soft_flag',
  HARD_BLOCK: 'hard_block',
  PAID: 'paid',
});

const REASON_CODES = Object.freeze({
  CLAIM_FILED: 'CLAIM_FILED',
  POLICY_INACTIVE: 'POLICY_INACTIVE',
  POLICY_EXPIRED: 'POLICY_EXPIRED',
  TRIGGER_NOT_COVERED: 'TRIGGER_NOT_COVERED',
  TRIGGER_THRESHOLD_NOT_MET: 'TRIGGER_THRESHOLD_NOT_MET',
  POLICY_EXCLUSION_HIT: 'POLICY_EXCLUSION_HIT',
  FRAUD_AUTO_APPROVE: 'FRAUD_AUTO_APPROVE',
  FRAUD_SOFT_FLAG: 'FRAUD_SOFT_FLAG',
  FRAUD_HARD_BLOCK: 'FRAUD_HARD_BLOCK',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  MANUAL_APPROVAL: 'MANUAL_APPROVAL',
  MANUAL_REJECTION: 'MANUAL_REJECTION',
  PAYOUT_SETTLED: 'PAYOUT_SETTLED',
});

const mapVerdictToReasonCode = (verdict) => {
  if (verdict === VERDICTS.HARD_BLOCK) return REASON_CODES.FRAUD_HARD_BLOCK;
  if (verdict === VERDICTS.SOFT_FLAG) return REASON_CODES.FRAUD_SOFT_FLAG;
  return REASON_CODES.FRAUD_AUTO_APPROVE;
};

const mapVerdictToSettlementStatus = (verdict) => {
  if (verdict === VERDICTS.HARD_BLOCK) return SETTLEMENT_STATUS.HARD_BLOCK;
  if (verdict === VERDICTS.SOFT_FLAG) return SETTLEMENT_STATUS.SOFT_FLAG;
  return SETTLEMENT_STATUS.APPROVED;
};

const mapSettlementToWorkflowStatus = (settlementStatus) => {
  if (settlementStatus === SETTLEMENT_STATUS.SOFT_FLAG) return 'under_review';
  if (settlementStatus === SETTLEMENT_STATUS.HARD_BLOCK) return 'rejected';
  if (settlementStatus === SETTLEMENT_STATUS.PAID) return 'paid';
  if (settlementStatus === SETTLEMENT_STATUS.APPROVED) return 'approved';
  return 'pending';
};

const isPayoutEligible = (settlementStatus) => settlementStatus === SETTLEMENT_STATUS.APPROVED;

module.exports = {
  FRAUD_THRESHOLDS,
  VERDICTS,
  SETTLEMENT_STATUS,
  REASON_CODES,
  mapVerdictToReasonCode,
  mapVerdictToSettlementStatus,
  mapSettlementToWorkflowStatus,
  isPayoutEligible,
};
