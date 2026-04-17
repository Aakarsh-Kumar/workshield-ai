const axios = require('axios');
const Policy = require('../models/Policy');
const User = require('../models/User');
const { getLocationRiskMultiplier } = require('./riskProfileService');
const {
  DEFAULT_POLICY_EXCLUSIONS,
  DEFAULT_UNDERWRITING_GUIDELINES,
} = require('../constants/policyCompliance');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:5001';

const PLAN_TIERS = Object.freeze([
  {
    id: 'basic',
    minCoverage: 1000,
    maxCoverage: 1999,
    triggers: [
      { type: 'rainfall', threshold: 50, payoutRatio: 0.45 },
      { type: 'platform_outage', threshold: 4, payoutRatio: 0.25 },
    ],
  },
  {
    id: 'plus',
    minCoverage: 2000,
    maxCoverage: 4999,
    triggers: [
      { type: 'rainfall', threshold: 50, payoutRatio: 0.5 },
      { type: 'platform_outage', threshold: 4, payoutRatio: 0.3 },
      { type: 'vehicle_accident', threshold: 1, payoutRatio: 0.75 },
      { type: 'hospitalization', threshold: 1, payoutRatio: 0.75 },
    ],
  },
  {
    id: 'pro',
    minCoverage: 5000,
    maxCoverage: Number.POSITIVE_INFINITY,
    triggers: [
      { type: 'rainfall', threshold: 50, payoutRatio: 0.5 },
      { type: 'platform_outage', threshold: 4, payoutRatio: 0.3 },
      { type: 'vehicle_accident', threshold: 1, payoutRatio: 1.0 },
      { type: 'hospitalization', threshold: 1, payoutRatio: 1.0 },
      { type: 'traffic_congestion', threshold: 45, payoutRatio: 0.25 },
    ],
  },
]);

const getTierForCoverage = (coverageAmount) => PLAN_TIERS.find(
  (tier) => coverageAmount >= tier.minCoverage && coverageAmount <= tier.maxCoverage,
) || PLAN_TIERS[PLAN_TIERS.length - 1];

const getTriggersForCoverage = (coverageAmount) => getTierForCoverage(Number(coverageAmount || 0)).triggers;

const normalizeTriggerConfig = (coverageAmount, triggerConfig) => {
  const baseTriggers = getTriggersForCoverage(coverageAmount);
  if (!Array.isArray(triggerConfig) || triggerConfig.length === 0) {
    return baseTriggers;
  }

  const allowedTypes = new Set(baseTriggers.map((trigger) => trigger.type));
  return triggerConfig.filter((trigger) => allowedTypes.has(trigger.type));
};

const getPremiumPrediction = async (weeklyDeliveries, platform, riskScore, locationRiskMultiplier = 1.0, coverageAmount = 1000) => {
  try {
    const { data } = await axios.post(
      `${AI_SERVICE_URL}/predict`,
      {
        weekly_deliveries: weeklyDeliveries,
        platform,
        risk_score: riskScore,
        location_risk_multiplier: locationRiskMultiplier,
        coverage_amount: coverageAmount,
      },
      { timeout: 5000 },
    );
    const predicted = Number(data.premium);
    if (Number.isFinite(predicted) && predicted > 0) {
      const coverageFactor = Math.max(1, Number(coverageAmount || 1000) / 1000);
      return Number((predicted * (0.85 + coverageFactor * 0.15)).toFixed(2));
    }
    return ruleBasedPremium(weeklyDeliveries, riskScore, locationRiskMultiplier, coverageAmount);
  } catch (err) {
    console.warn('AI premium prediction unavailable, using rule-based fallback:', err.message);
    return ruleBasedPremium(weeklyDeliveries, riskScore, locationRiskMultiplier, coverageAmount);
  }
};

const ruleBasedPremium = (weeklyDeliveries, riskScore, locationRiskMultiplier = 1.0, coverageAmount = 1000) => {
  const base = 18;
  const loadFactor = weeklyDeliveries > 40 ? 1.6 : weeklyDeliveries > 20 ? 1.3 : 1.0;
  const multiplier = Math.max(0.5, Math.min(Number(locationRiskMultiplier) || 1.0, 3.0));
  const coverageFactor = Math.max(1, Number(coverageAmount || 1000) / 1000);
  return Number(Math.min(base * loadFactor * (1 + riskScore * 0.5) * multiplier * coverageFactor, 500).toFixed(2));
};

const createPolicy = async (userId, { type = 'weekly', coverageAmount, triggerConfig }) => {
  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  const { locationRiskMultiplier } = await getLocationRiskMultiplier(userId)
    .catch(() => ({ locationRiskMultiplier: 1.0 }));

  const premium = await getPremiumPrediction(
    user.weeklyDeliveries,
    user.platform,
    user.riskScore,
    locationRiskMultiplier,
    coverageAmount,
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
    triggers: normalizeTriggerConfig(coverageAmount, triggerConfig),
    aiRiskScore: user.riskScore,
    weeklyDeliveriesAtIssuance: user.weeklyDeliveries,
    platform: user.platform,
    exclusions: DEFAULT_POLICY_EXCLUSIONS,
    termsVersion: '1.0',
    regulatoryReference: 'IRDAI_REFERENCE_PENDING',
    underwritingGuidelines: DEFAULT_UNDERWRITING_GUIDELINES,
  });

  return policy;
};

module.exports = {
  PLAN_TIERS,
  createPolicy,
  getPremiumPrediction,
  getTriggersForCoverage,
  getTierForCoverage,
  normalizeTriggerConfig,
};
