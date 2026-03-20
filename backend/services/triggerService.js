const Policy = require('../models/Policy');
const Claim = require('../models/Claim');

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
    return { triggered: false, payoutRatio: 0, reason: 'Trigger type not covered in policy' };
  }

  const triggered = triggerValue >= trigger.threshold;
  return {
    triggered,
    payoutRatio: triggered ? trigger.payoutRatio : 0,
    threshold: trigger.threshold,
    observed: triggerValue,
    triggerType,
  };
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
const processTriggerEvent = async (policyId, triggerType, triggerValue) => {
  const policy = await Policy.findById(policyId).populate('userId');

  if (!policy) throw new Error('Policy not found');
  if (policy.status !== 'active') throw new Error(`Policy is ${policy.status}, not active`);
  if (new Date() > policy.endDate) throw new Error('Policy has expired');

  const evaluation = evaluateTrigger(policy, triggerType, Number(triggerValue));

  if (!evaluation.triggered) {
    return {
      triggered: false,
      message: `Trigger threshold not met (observed: ${triggerValue}, threshold: ${evaluation.threshold})`,
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
  });

  return { triggered: true, claim, evaluation, claimAmount };
};

module.exports = { evaluateTrigger, calculateLoss, processTriggerEvent };
