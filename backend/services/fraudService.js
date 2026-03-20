const axios = require('axios');
const Claim = require('../models/Claim');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:5001';

/**
 * checkFraud — sends claim data to the Python AI fraud detection endpoint.
 *
 * Fraud patterns in Indian gig-worker parametric insurance:
 *  - Policy taken hours before a known flood event
 *  - Claim amount inflated beyond typical daily earning
 *  - Ghost workers (very low delivery count registering and immediately claiming)
 *  - Trigger values reported right at the payout threshold
 *
 * @param {string} claimId  — MongoDB ObjectId string
 * @returns {Promise<{ fraudScore: number, isFraudulent: boolean }>}
 */
const checkFraud = async (claimId) => {
  const claim = await Claim.findById(claimId)
    .populate('policyId', 'coverageAmount createdAt triggers')
    .populate('userId', 'weeklyDeliveries platform');

  if (!claim) throw new Error('Claim not found');

  const payload = {
    claim_id: claim._id.toString(),
    trigger_type: claim.triggerType,
    trigger_value: claim.triggerValue,
    claim_amount: claim.claimAmount,
    user_weekly_deliveries: claim.userId?.weeklyDeliveries ?? 0,
    policy_age_days: claim.policyId
      ? Math.floor((Date.now() - new Date(claim.policyId.createdAt).getTime()) / 86_400_000)
      : 0,
    platform: claim.userId?.platform ?? 'unknown',
  };

  let fraudScore = 0;
  let isFraudulent = false;
  let recommendation = 'AUTO_APPROVE';

  try {
    const { data } = await axios.post(`${AI_SERVICE_URL}/fraud-check`, payload, { timeout: 5000 });
    fraudScore = data.fraud_score ?? 0;
    isFraudulent = data.is_fraudulent ?? false;
    recommendation = data.recommendation ?? 'AUTO_APPROVE';
  } catch (err) {
    console.warn('⚠️  AI fraud check unavailable, using rule-based fallback:', err.message);
    ({ fraudScore, isFraudulent } = ruleBasedFraudCheck(payload));
  }

  // Persist fraud assessment back to the claim
  await Claim.findByIdAndUpdate(claimId, {
    fraudScore,
    isFraudulent,
    status: isFraudulent ? 'rejected' : 'under_review',
    remarks: isFraudulent ? 'Flagged as potentially fraudulent by AI assessment' : undefined,
    processedAt: isFraudulent ? new Date() : undefined,
  });

  return { fraudScore, isFraudulent, recommendation };
};

/**
 * ruleBasedFraudCheck — deterministic fallback when AI service is unavailable.
 * Mirrors the heuristic logic in the Python service.
 */
const ruleBasedFraudCheck = ({ policy_age_days, claim_amount, user_weekly_deliveries }) => {
  let score = 0;

  if (policy_age_days < 1) score += 0.4;
  else if (policy_age_days < 3) score += 0.2;

  if (claim_amount > 10000) score += 0.25;
  else if (claim_amount > 5000) score += 0.1;

  if (user_weekly_deliveries < 3) score += 0.2;

  return {
    fraudScore: Math.min(Number(score.toFixed(4)), 1.0),
    isFraudulent: score >= 0.5,
  };
};

module.exports = { checkFraud };
