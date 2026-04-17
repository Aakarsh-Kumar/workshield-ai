const axios = require('axios');
const Claim = require('../models/Claim');
const LocationPing = require('../models/LocationPing');
const { buildTransition } = require('./settlementService');
const {
  REASON_CODES,
  SETTLEMENT_STATUS,
  VERDICTS,
  mapVerdictToReasonCode,
  mapVerdictToSettlementStatus,
} = require('../constants/decisionContract');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:5001';

const toRadians = (value) => (Number(value) * Math.PI) / 180;
const haversineKm = (from, to) => {
  if (!from || !to) return 0;
  const earthRadiusKm = 6371;
  const dLat = toRadians(Number(to.latitude) - Number(from.latitude));
  const dLng = toRadians(Number(to.longitude) - Number(from.longitude));
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(Number(from.latitude)))
    * Math.cos(toRadians(Number(to.latitude)))
    * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

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

const getReferenceLocation = (claim) => {
  const verification = claim?.evaluationMeta?.verification || {};
  if (verification.referenceLocation?.latitude && verification.referenceLocation?.longitude) {
    return verification.referenceLocation;
  }
  if (verification.latitude && verification.longitude) {
    return {
      latitude: verification.latitude,
      longitude: verification.longitude,
    };
  }
  return null;
};

const getRecentWindowCoverageRatio = (claim) => {
  const timeWindow = claim?.evaluationMeta?.verification?.timeWindow;
  const actualDurationMinutes = Number(claim?.evaluationMeta?.verification?.actualDurationMinutes || 0);
  if (!timeWindow?.start || !timeWindow?.end) return 1.0;

  const requestedMinutes = Math.max(
    1,
    (new Date(timeWindow.end).getTime() - new Date(timeWindow.start).getTime()) / 60_000,
  );
  if (actualDurationMinutes <= 0) return 0;
  return Math.max(0, Math.min(actualDurationMinutes / requestedMinutes, 1));
};

const getOperationalSignals = async (claim) => {
  const verification = claim?.evaluationMeta?.verification || {};
  const routeSignature = verification.routeSignature || null;
  const referenceLocation = getReferenceLocation(claim);
  const now = new Date(claim.createdAt || new Date());
  const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const from7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const previousClaim = await Claim.findOne({
    userId: claim.userId?._id,
    _id: { $ne: claim._id },
  }).sort({ createdAt: -1 }).lean();

  let impossibleTravelFlag = 0;
  let previousDistanceKm = 0;
  if (previousClaim && referenceLocation) {
    const previousLocation = getReferenceLocation(previousClaim);
    if (previousLocation) {
      previousDistanceKm = haversineKm(previousLocation, referenceLocation);
      const hoursGap = Math.max(
        1 / 60,
        Math.abs(new Date(claim.createdAt).getTime() - new Date(previousClaim.createdAt).getTime()) / 3_600_000,
      );
      impossibleTravelFlag = previousDistanceKm / hoursGap > 80 ? 1 : 0;
    }
  }

  const [recentClaimsSameRoute24h, repeatedRouteClaims7d, clusterClaims24h, latestPing, recentPings24h] = await Promise.all([
    routeSignature
      ? Claim.countDocuments({
        _id: { $ne: claim._id },
        createdAt: { $gte: from24h },
        'evaluationMeta.verification.routeSignature': routeSignature,
      })
      : Promise.resolve(0),
    routeSignature
      ? Claim.countDocuments({
        _id: { $ne: claim._id },
        createdAt: { $gte: from7d },
        'evaluationMeta.verification.routeSignature': routeSignature,
      })
      : Promise.resolve(0),
    referenceLocation
      ? Claim.countDocuments({
        _id: { $ne: claim._id },
        createdAt: { $gte: from24h },
        'evaluationMeta.verification.referenceLocation.latitude': {
          $gte: Number(referenceLocation.latitude) - 0.01,
          $lte: Number(referenceLocation.latitude) + 0.01,
        },
        'evaluationMeta.verification.referenceLocation.longitude': {
          $gte: Number(referenceLocation.longitude) - 0.01,
          $lte: Number(referenceLocation.longitude) + 0.01,
        },
      })
      : Promise.resolve(0),
    LocationPing.findOne({ workerId: claim.userId?._id }).sort({ timestamp: -1 }).lean(),
    LocationPing.find({
      workerId: claim.userId?._id,
      timestamp: { $gte: from24h },
    }).sort({ timestamp: -1 }).limit(200).lean(),
  ]);

  const distinctSessionCount24h = new Set(
    recentPings24h
      .map((ping) => ping?.telemetry?.sessionId)
      .filter(Boolean),
  ).size;
  const distinctDeviceCount24h = new Set(
    recentPings24h
      .map((ping) => ping?.telemetry?.deviceId)
      .filter(Boolean),
  ).size;
  const offlineSyncRatio24h = recentPings24h.length > 0
    ? recentPings24h.filter((ping) => ping.isOfflineSync).length / recentPings24h.length
    : 0;
  const suspiciousSessionResetFlag = distinctSessionCount24h >= 4 ? 1 : 0;
  const telemetryDeviceChurnFlag = distinctDeviceCount24h >= 2 || distinctSessionCount24h >= 3 ? 1 : 0;

  const gpsDistanceToEventZoneKm = referenceLocation && latestPing?.location?.coordinates
    ? haversineKm(referenceLocation, {
      latitude: Number(latestPing.location.coordinates[1]),
      longitude: Number(latestPing.location.coordinates[0]),
    })
    : 0;

  return {
    routeSignature,
    referenceLocation,
    recentClaimsSameRoute24h,
    repeatedRouteClaims7d,
    clusterClaims24h,
    impossibleTravelFlag,
    distinctSessionCount24h,
    distinctDeviceCount24h,
    offlineSyncRatio24h: Number(offlineSyncRatio24h.toFixed(2)),
    suspiciousSessionResetFlag,
    telemetryDeviceChurnFlag,
    latestTelemetry: latestPing?.telemetry || null,
    previousDistanceKm: Number(previousDistanceKm.toFixed(2)),
    gpsDistanceToEventZoneKm: Number(gpsDistanceToEventZoneKm.toFixed(2)),
    activeHoursOverlapRatio: getRecentWindowCoverageRatio(claim),
  };
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
const checkFraud = async (claimId, options = {}) => {
  const {
    allowAutoApprove = true,
    preservePendingReason = false,
  } = options;
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
  const operationalSignals = await getOperationalSignals(claim);

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
    gps_distance_to_event_zone_km: operationalSignals.gpsDistanceToEventZoneKm,
    active_hours_overlap_ratio: operationalSignals.activeHoursOverlapRatio,
    recent_claims_same_zone_24h: Math.max(recentClaimsByTrigger, operationalSignals.clusterClaims24h),
    recent_claims_same_device_24h: Math.max(
      operationalSignals.recentClaimsSameRoute24h,
      operationalSignals.distinctDeviceCount24h,
    ),
    recent_claims_same_ip_24h: recentClaimsByUser,
    device_rooted_flag: operationalSignals.telemetryDeviceChurnFlag,
    mock_location_flag: operationalSignals.offlineSyncRatio24h >= 0.8 ? 1 : 0,
    gps_speed_jump_flag: operationalSignals.impossibleTravelFlag,
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
      operationalSignals,
    };
  }

  if (operationalSignals.telemetryDeviceChurnFlag) {
    signals = Array.from(new Set([...signals, 'telemetry_device_churn']));
  }
  if (operationalSignals.offlineSyncRatio24h >= 0.8) {
    signals = Array.from(new Set([...signals, 'offline_sync_heavy']));
  }
  if (operationalSignals.suspiciousSessionResetFlag) {
    signals = Array.from(new Set([...signals, 'suspicious_session_reset']));
  }

  const targetSettlementStatus = mapVerdictToSettlementStatus(verdict);
  const shouldStayPending = !allowAutoApprove && verdict === VERDICTS.AUTO_APPROVE;
  const existingEvaluationMeta = claim.evaluationMeta && typeof claim.evaluationMeta === 'object'
    ? claim.evaluationMeta
    : {};

  if (shouldStayPending) {
    const nextReasonDetail = preservePendingReason && claim.reasonDetail
      ? claim.reasonDetail
      : 'Fraud score completed. Claim is still waiting for manual verification.';

    await Claim.findByIdAndUpdate(claimId, {
      fraudScore,
      isFraudulent,
      fraudVerdict: verdict,
      fraudSignals: signals,
      fraudModelVersion: modelVersion,
      reasonCode: claim.reasonCode || REASON_CODES.CLAIM_FILED,
      reasonDetail: nextReasonDetail,
      payoutEligibility: false,
      evaluationMeta: {
        ...existingEvaluationMeta,
        fraud: {
          ...evaluationMeta,
          modelVersion,
          ruleHits: signals,
          operationalSignals,
          timestamp: new Date().toISOString(),
        },
      },
      remarks: nextReasonDetail,
    });

    return {
      fraudScore,
      isFraudulent,
      verdict,
      recommendation,
      reasonCode: claim.reasonCode || REASON_CODES.CLAIM_FILED,
      reasonDetail: nextReasonDetail,
      settlementStatus: claim.settlementStatus || SETTLEMENT_STATUS.PENDING,
      payoutEligibility: false,
      evaluationMeta,
    };
  }

  const transition = buildTransition({
    currentStatus: claim.settlementStatus || SETTLEMENT_STATUS.PENDING,
    targetStatus: targetSettlementStatus,
    reasonCode,
    reasonDetail,
    evaluationMeta: {
      ...existingEvaluationMeta,
      fraud: {
        ...evaluationMeta,
        modelVersion: modelVersion,
        ruleHits: signals,
        operationalSignals,
        timestamp: new Date().toISOString(),
      },
    },
  });

  if (!transition.ok) {
    await Claim.findByIdAndUpdate(claimId, {
      reasonCode: transition.error.reasonCode,
      reasonDetail: transition.error.reasonDetail,
      evaluationMeta: {
        ...existingEvaluationMeta,
        mode: 'transition_error',
        attemptedTarget: targetSettlementStatus,
        operationalSignals,
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
