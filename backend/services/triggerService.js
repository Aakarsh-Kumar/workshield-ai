const Policy = require('../models/Policy');
const Claim = require('../models/Claim');
const {
  REASON_CODES,
  SETTLEMENT_STATUS,
  VERDICTS,
} = require('../constants/decisionContract');

/**
 * evaluateTrigger — checks if an observed event value exceeds the policy's trigger threshold.
 *
 * This is the core of parametric insurance: no subjective loss assessment needed.
 * The payout ratio is pre-agreed at issuance.
 *
 * @param {object} policy  — Mongoose Policy document
 * @param {string} triggerType
 * @param {number} triggerValue  — observed value (mm rain, hours outage, etc.)
 * @returns {{ triggered, payoutRatio, threshold, observed }}
 */
const evaluateTrigger = (policy, triggerType, triggerValue) => {
  const trigger = policy.triggers.find((t) => t.type === triggerType);
  if (!trigger) {
    return {
      triggered: false,
      payoutRatio: 0,
      threshold: null,
      observed: triggerValue,
      triggerType,
      reasonCode: REASON_CODES.TRIGGER_NOT_COVERED,
      reasonDetail: 'Trigger type not covered in policy',
    };
  }

  const triggered = triggerValue >= trigger.threshold;
  return {
    triggered,
    payoutRatio: triggered ? trigger.payoutRatio : 0,
    threshold: trigger.threshold,
    observed: triggerValue,
    triggerType,
    reasonCode: triggered ? REASON_CODES.CLAIM_FILED : REASON_CODES.TRIGGER_THRESHOLD_NOT_MET,
    reasonDetail: triggered
      ? 'Trigger threshold met'
      : `Trigger threshold not met (observed: ${triggerValue}, threshold: ${trigger.threshold})`,
  };
};

const checkExclusion = (policy, eventMeta = {}) => {
  const exclusionCode = String(eventMeta.exclusionCode || eventMeta.eventCategory || '').trim();
  if (!exclusionCode) {
    return { hit: false };
  }

  const policyExclusions = policy.exclusions || [];
  if (policyExclusions.includes(exclusionCode)) {
    return {
      hit: true,
      exclusionCode,
      reasonCode: REASON_CODES.POLICY_EXCLUSION_HIT,
      reasonDetail: `Excluded by policy clause: ${exclusionCode}`,
    };
  }

  return { hit: false };
};

/**
 * calculateLoss — derives the payout amount from the policy coverage and payout ratio.
 *
 * @param {object} policy
 * @param {number} payoutRatio  0–1
 * @returns {number} INR amount
 */
const calculateLoss = (policy, payoutRatio) => {
  return Math.round(policy.coverageAmount * payoutRatio);
};

/**
 * processTriggerEvent — end-to-end flow for an incoming trigger oracle event.
 *
 * In production, this would be called by:
 *  - IMD weather API webhook (rainfall)
 *  - Platform status-page scraper (outage)
 *  - Hospital discharge API (hospitalization)
 *  - Telematics / FIR API (accident)
 *
 * @param {string} policyId
 * @param {string} triggerType
 * @param {number} triggerValue
 * @returns {Promise<{ triggered, claim?, evaluation, claimAmount? }>}
 */
const processTriggerEvent = async (policyId, triggerType, triggerValue, eventMeta = {}) => {
  const policy = await Policy.findById(policyId).populate('userId');

  if (!policy) throw new Error('Policy not found');
  if (policy.status !== 'active') throw new Error(`Policy is ${policy.status}, not active`);
  if (new Date() > policy.endDate) throw new Error('Policy has expired');

  const exclusion = checkExclusion(policy, eventMeta);
  if (exclusion.hit) {
    return {
      triggered: false,
      verdict: VERDICTS.HARD_BLOCK,
      reasonCode: exclusion.reasonCode,
      reasonDetail: exclusion.reasonDetail,
      settlementStatus: SETTLEMENT_STATUS.HARD_BLOCK,
      payoutEligibility: false,
      evaluation: {
        triggerType,
        observed: Number(triggerValue),
        exclusionCode: exclusion.exclusionCode,
      },
    };
  }

  const evaluation = evaluateTrigger(policy, triggerType, Number(triggerValue));

  if (!evaluation.triggered) {
    return {
      triggered: false,
      verdict: VERDICTS.AUTO_APPROVE,
      reasonCode: evaluation.reasonCode,
      reasonDetail: evaluation.reasonDetail,
      settlementStatus: SETTLEMENT_STATUS.PENDING,
      payoutEligibility: false,
      message: evaluation.reasonDetail,
      evaluation,
    };
  }

  const claimAmount = calculateLoss(policy, evaluation.payoutRatio);

  const claim = await Claim.create({
    policyId: policy._id,
    userId: policy.userId._id || policy.userId,
    triggerType,
    triggerValue,
    claimAmount,
    status: 'pending',
    settlementStatus: SETTLEMENT_STATUS.PENDING,
    reasonCode: REASON_CODES.CLAIM_FILED,
    reasonDetail: 'Claim created from validated trigger event',
    payoutEligibility: false,
    evaluationMeta: {
      triggerType,
      triggerValue: Number(triggerValue),
      threshold: evaluation.threshold,
      payoutRatio: evaluation.payoutRatio,
      timestamp: new Date().toISOString(),
    },
  });

  return {
    triggered: true,
    claim,
    evaluation,
    claimAmount,
    verdict: VERDICTS.AUTO_APPROVE,
    reasonCode: REASON_CODES.CLAIM_FILED,
    reasonDetail: 'Trigger validated and claim created for fraud evaluation',
    settlementStatus: SETTLEMENT_STATUS.PENDING,
    payoutEligibility: false,
  };
};

module.exports = {
  evaluateTrigger,
  calculateLoss,
  checkExclusion,
  processTriggerEvent,
};
