const axios = require('axios');
const Policy = require('../models/Policy');
const User = require('../models/User');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:5001';

/**
 * defaultTriggers — standard parametric trigger set for Indian gig delivery workers.
 *
 * Trigger types and their economic rationale:
 *  - rainfall:         Heavy rain (>50mm) prevents safe delivery, causing income loss
 *  - vehicle_accident: Any accident = total income loss + medical cost
 *  - platform_outage:  >4hr outage on Swiggy/Zomato/Blinkit = lost order window
 *  - hospitalization:  Any inpatient admission = complete income stoppage
 */
const defaultTriggers = () => [
  { type: 'rainfall', threshold: 50, payoutRatio: 0.5 },       // >50mm → 50% payout
  { type: 'vehicle_accident', threshold: 1, payoutRatio: 1.0 }, // any accident → full payout
  { type: 'platform_outage', threshold: 4, payoutRatio: 0.3 },  // >4hrs outage → 30% payout
  { type: 'hospitalization', threshold: 1, payoutRatio: 1.0 },  // hospitalized → full payout
];

/**
 * getPremiumPrediction — calls the Python AI service for an actuarial premium quote.
 * Falls back to a rule-based calculation if the AI service is unavailable.
 *
 * @param {number} weeklyDeliveries
 * @param {string} platform
 * @param {number} riskScore  0–1
 * @returns {Promise<number>} premium in INR
 */
const getPremiumPrediction = async (weeklyDeliveries, platform, riskScore) => {
  try {
    const { data } = await axios.post(
      `${AI_SERVICE_URL}/predict`,
      { weekly_deliveries: weeklyDeliveries, platform, risk_score: riskScore },
      { timeout: 5000 },
    );
    return data.premium;
  } catch (err) {
    console.warn('⚠️  AI premium prediction unavailable, using rule-based fallback:', err.message);
    return ruleBasedPremium(weeklyDeliveries, riskScore);
  }
};

/** Simple actuarial fallback when AI service is down */
const ruleBasedPremium = (weeklyDeliveries, riskScore) => {
  const base = 45;
  const loadFactor = weeklyDeliveries > 40 ? 1.6 : weeklyDeliveries > 20 ? 1.3 : 1.0;
  return Math.round(Math.min(base * loadFactor * (1 + riskScore * 0.5), 500));
};

/**
 * createPolicy — issues a new parametric policy after fetching an AI premium quote.
 *
 * @param {string} userId
 * @param {{ type, coverageAmount, triggerConfig }} policyData
 * @returns {Promise<Policy>}
 */
const createPolicy = async (userId, { type = 'weekly', coverageAmount, triggerConfig }) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  // Fetch AI-powered premium
  const premium = await getPremiumPrediction(
    user.weeklyDeliveries,
    user.platform,
    user.riskScore,
  );

  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + (type === 'weekly' ? 7 : 1));

  const policy = await Policy.create({
    userId,
    type,
    coverageAmount,
    premium,
    startDate: now,
    endDate,
    triggers: triggerConfig || defaultTriggers(),
    aiRiskScore: user.riskScore,
    weeklyDeliveriesAtIssuance: user.weeklyDeliveries,
    platform: user.platform,
  });

  return policy;
};

module.exports = { createPolicy, getPremiumPrediction };
