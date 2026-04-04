const axios = require('axios');
const Claim = require('../models/Claim');
const { buildTransition } = require('./settlementService');
const {
  REASON_CODES,
  SETTLEMENT_STATUS,
  VERDICTS,
  mapVerdictToReasonCode,
  mapVerdictToSettlementStatus,
} = require('../constants/decisionContract');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:5001';

const hoursSince = (dateValue) => {
  if (!dateValue) return 0;
  return Math.max(0, (Date.now() - new Date(dateValue).getTime()) / 3_600_000);
};

const getTriggerConfig = (policy, triggerType) => {
  const trigger = policy?.triggers?.find((t) => t.type === triggerType);
  return {
    threshold: Number(trigger?.threshold ?? 1),
    payoutRatio: Number(trigger?.payoutRatio ?? 0.5),
  };
};

const recommendationFromVerdict = (verdict) => {
  if (verdict === 'hard_block') return 'REJECT';
  if (verdict === 'soft_flag') return 'FLAG_FOR_REVIEW';
  return 'AUTO_APPROVE';
};

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
 * @returns {Promise<{ fraudScore: number, isFraudulent: boolean, verdict: string, recommendation: string }>}
 */
const checkFraud = async (claimId) => {
  const claim = await Claim.findById(claimId)
    .populate('policyId', 'coverageAmount createdAt triggers exclusions')
    .populate('userId', 'weeklyDeliveries platform');

  if (!claim) throw new Error('Claim not found');

  const now = new Date();
  const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentClaimsByUser = await Claim.countDocuments({ userId: claim.userId?._id, createdAt: { $gte: from24h } });
  const recentClaimsByTrigger = await Claim.countDocuments({
    triggerType: claim.triggerType,
    createdAt: { $gte: from24h },
  });

  const triggerConfig = getTriggerConfig(claim.policyId, claim.triggerType);
  const claimAmount = Number(claim.claimAmount ?? 0);
  const threshold = Math.max(triggerConfig.threshold, 1e-6);

  const payload = {
    claim_id: claim._id.toString(),
    event_ts: (claim.createdAt || now).toISOString(),
    trigger_type: claim.triggerType,
    trigger_value: claim.triggerValue,
    claim_amount: claimAmount,
    coverage_amount: Number(claim.policyId?.coverageAmount ?? 500),
    trigger_threshold: threshold,
    trigger_gap_ratio: Math.max(0, Number(claim.triggerValue ?? 0) - threshold) / threshold,
    payout_ratio: triggerConfig.payoutRatio,
    income_loss_estimate: claimAmount,
    weather_severity: 2,
    gps_distance_to_event_zone_km: 0,
    active_hours_overlap_ratio: 1.0,
    recent_claims_same_zone_24h: recentClaimsByTrigger,
    recent_claims_same_device_24h: 0,
    recent_claims_same_ip_24h: recentClaimsByUser,
    device_rooted_flag: 0,
    mock_location_flag: 0,
    gps_speed_jump_flag: 0,
    policy_exclusion_hit_flag: 0,
    user_weekly_deliveries: claim.userId?.weeklyDeliveries ?? 0,
    policy_age_days: Math.floor(hoursSince(claim.policyId?.createdAt) / 24),
    policy_age_hours: hoursSince(claim.policyId?.createdAt),
    platform: claim.userId?.platform ?? 'unknown',
  };

  let fraudScore = 0;
  let isFraudulent = false;
  let verdict = 'auto_approve';
  let signals = [];
  let modelVersion = 'heuristic-fallback';
  let recommendation = 'AUTO_APPROVE';
  let reasonCode = REASON_CODES.FRAUD_AUTO_APPROVE;
  let reasonDetail = 'Claim auto-approved by fraud model';
  let evaluationMeta = {};

  try {
    const { data } = await axios.post(`${AI_SERVICE_URL}/fraud-check`, payload, { timeout: 5000 });
    fraudScore = data.fraudScore ?? data.fraud_score ?? 0;
    isFraudulent = data.is_fraudulent ?? data.isFraudulent ?? false;
    verdict = data.verdict ?? (isFraudulent ? VERDICTS.HARD_BLOCK : VERDICTS.AUTO_APPROVE);
    signals = Array.isArray(data.signals) ? data.signals : [];
    modelVersion = data.model_version ?? 'unknown';
    recommendation = data.recommendation ?? 'AUTO_APPROVE';
    reasonCode = data.reasonCode ?? mapVerdictToReasonCode(verdict);
    reasonDetail = data.reasonDetail
      ?? (verdict === VERDICTS.HARD_BLOCK
        ? 'Claim blocked by fraud model decision'
        : verdict === VERDICTS.SOFT_FLAG
          ? 'Claim soft-flagged for manual review'
          : 'Claim auto-approved by fraud model');
    evaluationMeta = data.evaluationMeta ?? data.evaluation_meta ?? {};
  } catch (err) {
    console.warn('⚠️  AI fraud check unavailable, using rule-based fallback:', err.message);
    ({ fraudScore, isFraudulent, verdict } = ruleBasedFraudCheck(payload));
    recommendation = recommendationFromVerdict(verdict);
    reasonCode = mapVerdictToReasonCode(verdict);
    reasonDetail = 'Fallback fraud rules applied because AI service was unavailable';
    evaluationMeta = {
      mode: 'backend_rule_fallback',
      fallbackError: err.message,
    };
  }

  const targetSettlementStatus = mapVerdictToSettlementStatus(verdict);
  const transition = buildTransition({
    currentStatus: claim.settlementStatus || SETTLEMENT_STATUS.PENDING,
    targetStatus: targetSettlementStatus,
    reasonCode,
    reasonDetail,
    evaluationMeta: {
      ...evaluationMeta,
      modelVersion: modelVersion,
      ruleHits: signals,
      timestamp: new Date().toISOString(),
    },
  });

  if (!transition.ok) {
    await Claim.findByIdAndUpdate(claimId, {
      reasonCode: transition.error.reasonCode,
      reasonDetail: transition.error.reasonDetail,
      evaluationMeta: {
        mode: 'transition_error',
        attemptedTarget: targetSettlementStatus,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      fraudScore,
      isFraudulent,
      verdict,
      recommendation,
      reasonCode: transition.error.reasonCode,
      reasonDetail: transition.error.reasonDetail,
    };
  }

  const remarks = reasonDetail;

  // Persist fraud assessment back to the claim
  await Claim.findByIdAndUpdate(claimId, {
    fraudScore,
    isFraudulent,
    fraudVerdict: verdict,
    fraudSignals: signals,
    fraudModelVersion: modelVersion,
    remarks,
    ...transition.patch,
  });

  return {
    fraudScore,
    isFraudulent,
    verdict,
    recommendation,
    reasonCode,
    reasonDetail,
    settlementStatus: targetSettlementStatus,
    payoutEligibility: transition.patch.payoutEligibility,
    evaluationMeta: transition.patch.evaluationMeta,
  };
};

/**
 * ruleBasedFraudCheck — deterministic fallback when AI service is unavailable.
 * Mirrors the heuristic logic in the Python service.
 */
const ruleBasedFraudCheck = ({ policy_age_hours, claim_amount, user_weekly_deliveries }) => {
  let score = 0;

  if (policy_age_hours < 24) score += 0.35;
  else if (policy_age_hours < 72) score += 0.15;

  if (claim_amount > 10000) score += 0.25;
  else if (claim_amount > 5000) score += 0.1;

  if (user_weekly_deliveries < 3) score += 0.2;

  const fraudScore = Math.min(Number(score.toFixed(4)), 1.0);
  const verdict = fraudScore >= 0.7 ? VERDICTS.HARD_BLOCK : fraudScore >= 0.3 ? VERDICTS.SOFT_FLAG : VERDICTS.AUTO_APPROVE;

  return {
    fraudScore,
    isFraudulent: verdict === 'hard_block',
    verdict,
  };
};

module.exports = { checkFraud };
