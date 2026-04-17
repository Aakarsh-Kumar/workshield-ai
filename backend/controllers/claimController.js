const Claim = require('../models/Claim');
const Policy = require('../models/Policy');
const mongoose = require('mongoose');
const LocationPing = require('../models/LocationPing');
const { checkFraud } = require('../services/fraudService');
const { buildTransition } = require('../services/settlementService');
const { checkExclusion, evaluateTrigger } = require('../services/triggerService');
const { fetchTrafficBaseline } = require('../services/trafficService');
const { normalizeTriggerConfig } = require('../services/policyService');
const {
  REASON_CODES,
  SETTLEMENT_STATUS,
} = require('../constants/decisionContract');
const { fetchRainfallMm } = require('../services/weatherService');
const { validateWorkerInZone } = require('../services/zoneValidatorService');
const { enrichClaimRecord } = require('../services/claimLifecycleService');

const resolveActivePolicy = async (policyRef, userId) => {
  const policyLookup = String(policyRef || '').trim();
  if (!policyLookup) return null;

  const baseFilter = { userId, status: 'active' };

  if (mongoose.Types.ObjectId.isValid(policyLookup)) {
    const policyById = await Policy.findOne({ ...baseFilter, _id: policyLookup });
    if (policyById) return policyById;
  }

  return Policy.findOne({ ...baseFilter, policyNumber: policyLookup });
};

const haversineKm = (from, to) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const roundCoord = (value) => Number(Number(value).toFixed(3));

const buildRouteSignature = (pings = []) => {
  if (!Array.isArray(pings) || pings.length < 2) return null;

  const anchors = [pings[0], pings[Math.floor(pings.length / 2)], pings[pings.length - 1]]
    .filter(Boolean)
    .map((ping) => {
      const lng = roundCoord(ping.location.coordinates[0]);
      const lat = roundCoord(ping.location.coordinates[1]);
      return `${lat}:${lng}`;
    });

  return anchors.join('|');
};

const getRecentPing = async (workerId) => LocationPing.findOne({ workerId }).sort({ timestamp: -1 }).lean();

const getNearestPing = async (workerId, observedAt) => {
  const observedDate = new Date(observedAt);
  if (Number.isNaN(observedDate.getTime())) return null;

  const start = new Date(observedDate.getTime() - 12 * 60 * 60 * 1000);
  const end = new Date(observedDate.getTime() + 12 * 60 * 60 * 1000);
  const candidates = await LocationPing.find({
    workerId,
    timestamp: { $gte: start, $lte: end },
  }).sort({ timestamp: 1 }).limit(50).lean();

  if (candidates.length === 0) return null;

  return candidates.reduce((closest, current) => {
    const currentDiff = Math.abs(new Date(current.timestamp).getTime() - observedDate.getTime());
    const closestDiff = Math.abs(new Date(closest.timestamp).getTime() - observedDate.getTime());
    return currentDiff < closestDiff ? current : closest;
  });
};

const getWindowPings = async (workerId, timeWindow) => {
  if (!timeWindow?.start || !timeWindow?.end) return [];
  return LocationPing.find({
    workerId,
    timestamp: {
      $gte: new Date(timeWindow.start),
      $lte: new Date(timeWindow.end),
    },
  }).sort({ timestamp: 1 }).lean();
};

const deriveObservedTrigger = async ({
  workerId,
  platform,
  triggerType,
  triggerValue,
  weatherLookup,
  timeWindow,
}) => {
  if (triggerType === 'vehicle_accident' || triggerType === 'hospitalization') {
    return {
      observedTriggerValue: Number(triggerValue),
      verificationMeta: {
        source: 'document-claim-hint',
      },
      verified: false,
    };
  }

  if (triggerType === 'rainfall') {
    const latestPing = await getRecentPing(workerId);
    const observedAt = weatherLookup?.observedAt || latestPing?.timestamp;
    const nearestPing = observedAt ? await getNearestPing(workerId, observedAt) : null;
    const referencePing = nearestPing || latestPing;
    const latitude = Number(weatherLookup?.latitude ?? referencePing?.location?.coordinates?.[1]);
    const longitude = Number(weatherLookup?.longitude ?? referencePing?.location?.coordinates?.[0]);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !observedAt) {
      const error = new Error('No recent location ping found for rainfall verification');
      error.statusCode = 422;
      throw error;
    }
    const weatherObservation = await fetchRainfallMm({
      latitude,
      longitude,
      observedAt,
    });

    return {
      observedTriggerValue: Number(weatherObservation.rainfallMm),
      verificationMeta: {
        source: weatherObservation.source,
        observedDate: weatherObservation.observedDate,
        latitude,
        longitude,
        observedAt,
        pingTimestamp: referencePing?.timestamp || null,
        rainfallMm: weatherObservation.rainfallMm,
        referenceLocation: {
          latitude,
          longitude,
        },
      },
      verified: true,
    };
  }

  if (triggerType === 'platform_outage') {
    if (!timeWindow?.start || !timeWindow?.end) {
      const error = new Error('Outage start and end time are required');
      error.statusCode = 422;
      throw error;
    }

    const durationHours = Math.max(
      0,
      (new Date(timeWindow.end).getTime() - new Date(timeWindow.start).getTime()) / 3_600_000,
    );
    const recentPings = await getWindowPings(workerId, timeWindow);
    const latestPing = recentPings[recentPings.length - 1] || await getRecentPing(workerId);

    return {
      observedTriggerValue: Number(durationHours.toFixed(2)),
      verificationMeta: {
        source: 'submitted_outage_window',
        platform,
        timeWindow,
        requiresManualReview: true,
        referenceLocation: latestPing?.location?.coordinates
          ? {
            latitude: Number(latestPing.location.coordinates[1]),
            longitude: Number(latestPing.location.coordinates[0]),
          }
          : null,
      },
      verified: false,
    };
  }

  if (triggerType === 'traffic_congestion') {
    if (!timeWindow?.start || !timeWindow?.end) {
      const error = new Error('Congestion start and end time are required');
      error.statusCode = 422;
      throw error;
    }

    const pings = await getWindowPings(workerId, timeWindow);
    const selectedWindowMinutes = Math.max(
      0,
      (new Date(timeWindow.end).getTime() - new Date(timeWindow.start).getTime()) / 60_000,
    );

    if (pings.length < 2) {
      const latestPing = pings[pings.length - 1] || await getRecentPing(workerId);
      return {
        observedTriggerValue: Number(selectedWindowMinutes.toFixed(2)),
        verificationMeta: {
          source: 'submitted_congestion_window',
          pingCount: pings.length,
          timeWindow,
          requiresManualReview: true,
          reason: 'Insufficient synced pings for route-based verification',
          routeSignature: buildRouteSignature(pings),
          referenceLocation: latestPing?.location?.coordinates
            ? {
              latitude: Number(latestPing.location.coordinates[1]),
              longitude: Number(latestPing.location.coordinates[0]),
            }
            : null,
        },
        verified: false,
      };
    }

    const actualDurationMinutes = (new Date(pings[pings.length - 1].timestamp).getTime() - new Date(pings[0].timestamp).getTime()) / 60_000;
    const distanceKm = pings.slice(1).reduce((sum, ping, index) => {
      const previous = pings[index];
      return sum + haversineKm(
        {
          lat: Number(previous.location.coordinates[1]),
          lng: Number(previous.location.coordinates[0]),
        },
        {
          lat: Number(ping.location.coordinates[1]),
          lng: Number(ping.location.coordinates[0]),
        },
      );
    }, 0);
    const latestPing = pings[pings.length - 1];

    if (distanceKm < 0.2) {
      return {
        observedTriggerValue: Number(selectedWindowMinutes.toFixed(2)),
        verificationMeta: {
          source: 'submitted_congestion_window',
          pingCount: pings.length,
          distanceKm: Number(distanceKm.toFixed(2)),
          timeWindow,
          requiresManualReview: true,
          reason: 'Movement in selected window was too low for route-based verification',
          routeSignature: buildRouteSignature(pings),
          referenceLocation: latestPing?.location?.coordinates
            ? {
              latitude: Number(latestPing.location.coordinates[1]),
              longitude: Number(latestPing.location.coordinates[0]),
            }
            : null,
        },
        verified: false,
      };
    }
    let baseline;
    try {
      baseline = await fetchTrafficBaseline({
        latitude: Number(latestPing.location.coordinates[1]),
        longitude: Number(latestPing.location.coordinates[0]),
      });
    } catch (error) {
      return {
        observedTriggerValue: Number(selectedWindowMinutes.toFixed(2)),
        verificationMeta: {
          source: 'submitted_congestion_window',
          pingCount: pings.length,
          distanceKm: Number(distanceKm.toFixed(2)),
          timeWindow,
          requiresManualReview: true,
          reason: error.message || 'Traffic baseline provider unavailable',
          routeSignature: buildRouteSignature(pings),
          referenceLocation: latestPing?.location?.coordinates
            ? {
              latitude: Number(latestPing.location.coordinates[1]),
              longitude: Number(latestPing.location.coordinates[0]),
            }
            : null,
        },
        verified: false,
      };
    }
    const freeFlowSpeedKph = Math.max(Number(baseline.freeFlowSpeedKph || 0), 1);
    const expectedMinutes = (distanceKm / freeFlowSpeedKph) * 60;
    const delayMinutes = Math.max(0, actualDurationMinutes - expectedMinutes);

    return {
      observedTriggerValue: Number(delayMinutes.toFixed(2)),
      verificationMeta: {
        source: baseline.source,
        baseline,
        pingCount: pings.length,
        distanceKm: Number(distanceKm.toFixed(2)),
        actualDurationMinutes: Number(actualDurationMinutes.toFixed(2)),
        expectedMinutes: Number(expectedMinutes.toFixed(2)),
        delayMinutes: Number(delayMinutes.toFixed(2)),
        timeWindow,
        routeSignature: buildRouteSignature(pings),
        referenceLocation: {
          latitude: Number(latestPing.location.coordinates[1]),
          longitude: Number(latestPing.location.coordinates[0]),
        },
      },
      verified: true,
    };
  }

  return {
    observedTriggerValue: Number(triggerValue),
    verificationMeta: {
      source: 'client-submitted',
    },
    verified: false,
  };
};

/**
 * POST /api/claims
 * File a new claim against an active policy.
 * Body: { policyId, triggerType, triggerValue, documents? }
 *
 * Fraud check is triggered asynchronously so the worker gets an immediate response.
 */
exports.createClaim = async (req, res) => {
  try {
    const {
      policyId,
      triggerType,
      triggerValue,
      documents,
      exclusionCode,
      eventCategory,
      weatherLookup,
      eventPolygon,
      timeWindow,
    } = req.body;

    if (!policyId || !triggerType) {
      return res.status(400).json({
        success: false,
        message: 'policyId and triggerType are required',
      });
    }

    // Confirm the policy belongs to this worker and is active
    const policy = await resolveActivePolicy(policyId, req.user.id);
    if (!policy) {
      return res.status(404).json({
        success: false,
        message: 'Active policy not found. Use policy ID or policy number from dashboard.',
      });
    }

    if (new Date() > policy.endDate) {
      return res.status(400).json({ success: false, message: 'Policy has expired' });
    }

    const verification = await deriveObservedTrigger({
      workerId: req.user.id,
      platform: req.user.platform,
      triggerType,
      triggerValue,
      weatherLookup,
      timeWindow,
    });
    const observedTriggerValue = verification.observedTriggerValue;

    const exclusion = checkExclusion(policy, { exclusionCode, eventCategory });
    if (exclusion.hit) {
      return res.status(422).json({
        success: false,
        message: exclusion.reasonDetail,
        verdict: 'hard_block',
        reasonCode: exclusion.reasonCode,
        reasonDetail: exclusion.reasonDetail,
        settlementStatus: SETTLEMENT_STATUS.HARD_BLOCK,
        payoutEligibility: false,
      });
    }

    const normalizedPolicy = {
      ...policy.toObject(),
      triggers: normalizeTriggerConfig(policy.coverageAmount, policy.triggers),
    };
    const triggerEvaluation = evaluateTrigger(normalizedPolicy, triggerType, Number(observedTriggerValue));
    if (!triggerEvaluation.triggered) {
      return res.status(422).json({
        success: false,
        message: triggerEvaluation.reasonDetail,
        verdict: 'auto_approve',
        reasonCode: triggerEvaluation.reasonCode,
        reasonDetail: triggerEvaluation.reasonDetail,
        settlementStatus: SETTLEMENT_STATUS.PENDING,
        payoutEligibility: false,
      });
    }

    const claimAmount = Number((policy.coverageAmount || 0) * Number(triggerEvaluation.payoutRatio));
    const zoneValidation = await validateWorkerInZone(
      req.user.id,
      eventPolygon || null,
      timeWindow || { start: new Date(Date.now() - 4 * 60 * 60 * 1000), end: new Date() },
    ).catch(() => ({ inZone: null, matchedPing: null, pingCount: 0 }));

    const claim = await Claim.create({
      policyId: policy._id,
      userId: req.user.id,
      triggerType,
      triggerValue: Number(observedTriggerValue),
      claimAmount,
      documents: documents || [],
      status: 'pending',
      settlementStatus: SETTLEMENT_STATUS.PENDING,
      reasonCode: REASON_CODES.CLAIM_FILED,
      reasonDetail: verification.verified
        ? 'Claim submitted and queued for fraud evaluation'
        : 'Claim submitted and queued for manual verification',
      payoutEligibility: false,
      evaluationMeta: {
        source: 'claim_create',
        timestamp: new Date().toISOString(),
        trigger: {
          threshold: triggerEvaluation.threshold,
          observed: triggerEvaluation.observed,
          payoutRatio: triggerEvaluation.payoutRatio,
        },
        zoneValidation: {
          inZone: zoneValidation.inZone,
          matchedPingId: zoneValidation.matchedPing?._id || null,
          pingCount: zoneValidation.pingCount ?? 0,
        },
        verification: verification.verificationMeta,
      },
    });

    const fraudResult = await checkFraud(claim._id.toString(), {
      allowAutoApprove: verification.verified,
      preservePendingReason: !verification.verified,
    }).catch((e) => {
      console.error(`Fraud check failed for claim ${claim._id}:`, e.message);
      return null;
    });

    const latestClaim = await Claim.findById(claim._id)
      .populate('policyId', 'policyNumber type coverageAmount platform')
      .lean();

    res.status(201).json({
      success: true,
      claim: enrichClaimRecord(latestClaim || claim),
      fraudResult,
    });
  } catch (err) {
    console.error('createClaim error:', err);
    res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Failed to file claim' });
  }
};

/**
 * GET /api/claims
 * List all claims for the authenticated worker.
 */
exports.getClaims = async (req, res) => {
  try {
    const { status, scope } = req.query;
    const filter = {};

    if (!(req.user.role === 'admin' && scope === 'all')) {
      filter.userId = req.user.id;
    }

    if (status) filter.status = status;

    const claims = await Claim.find(filter)
      .populate('policyId', 'policyNumber type coverageAmount platform')
      .populate('userId', 'name email platform')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, claims: claims.map(enrichClaimRecord) });
  } catch (err) {
    console.error('getClaims error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch claims' });
  }
};

/**
 * GET /api/claims/:id
 */
exports.getClaim = async (req, res) => {
  try {
    const claim = await Claim.findOne({ _id: req.params.id, userId: req.user.id })
      .populate('policyId', 'policyNumber type coverageAmount triggers platform')
      .lean();

    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }
    res.json({ success: true, claim: enrichClaimRecord(claim) });
  } catch (err) {
    console.error('getClaim error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch claim' });
  }
};

/**
 * PATCH /api/claims/:id/approve  [admin only]
 * Approve a claim and set the approved payout amount.
 * Body: { approvedAmount, remarks? }
 */
exports.approveClaim = async (req, res) => {
  try {
    const { approvedAmount, remarks } = req.body;

    if (approvedAmount == null || approvedAmount < 0) {
      return res.status(400).json({ success: false, message: 'A valid approvedAmount is required' });
    }

    const existingClaim = await Claim.findById(req.params.id);
    if (!existingClaim) return res.status(404).json({ success: false, message: 'Claim not found' });

    const transition = buildTransition({
      currentStatus: existingClaim.settlementStatus || SETTLEMENT_STATUS.PENDING,
      targetStatus: SETTLEMENT_STATUS.APPROVED,
      reasonCode: REASON_CODES.MANUAL_APPROVAL,
      reasonDetail: remarks || 'Manually approved by admin',
      evaluationMeta: {
        source: 'manual_approval',
        timestamp: new Date().toISOString(),
      },
    });

    if (!transition.ok) {
      return res.status(409).json({ success: false, ...transition.error });
    }

    const claim = await Claim.findByIdAndUpdate(
      req.params.id,
      {
        approvedAmount: Number(approvedAmount),
        remarks,
        ...transition.patch,
      },
      { new: true },
    );

    res.json({ success: true, claim });
  } catch (err) {
    console.error('approveClaim error:', err);
    res.status(500).json({ success: false, message: 'Failed to approve claim' });
  }
};

/**
 * PATCH /api/claims/:id/reject  [admin only]
 * Reject a claim with a reason.
 */
exports.rejectClaim = async (req, res) => {
  try {
    const { remarks } = req.body;

    const existingClaim = await Claim.findById(req.params.id);
    if (!existingClaim) return res.status(404).json({ success: false, message: 'Claim not found' });

    const transition = buildTransition({
      currentStatus: existingClaim.settlementStatus || SETTLEMENT_STATUS.PENDING,
      targetStatus: SETTLEMENT_STATUS.HARD_BLOCK,
      reasonCode: REASON_CODES.MANUAL_REJECTION,
      reasonDetail: remarks || 'Manually rejected by admin',
      evaluationMeta: {
        source: 'manual_rejection',
        timestamp: new Date().toISOString(),
      },
    });

    if (!transition.ok) {
      return res.status(409).json({ success: false, ...transition.error });
    }

    const claim = await Claim.findByIdAndUpdate(
      req.params.id,
      { remarks, ...transition.patch },
      { new: true },
    );
    res.json({ success: true, claim });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reject claim' });
  }
};

/**
 * PATCH /api/claims/:id/paid [admin only]
 * Team 2 payout orchestration callback after transfer success.
 * Body: { payoutReference, remarks?, paidAmount? }
 */
exports.markClaimPaid = async (req, res) => {
  try {
    const { payoutReference, remarks, paidAmount } = req.body;

    if (!payoutReference) {
      return res.status(400).json({ success: false, message: 'payoutReference is required' });
    }

    const existingClaim = await Claim.findById(req.params.id);
    if (!existingClaim) return res.status(404).json({ success: false, message: 'Claim not found' });

    const transition = buildTransition({
      currentStatus: existingClaim.settlementStatus || SETTLEMENT_STATUS.PENDING,
      targetStatus: SETTLEMENT_STATUS.PAID,
      reasonCode: REASON_CODES.PAYOUT_SETTLED,
      reasonDetail: remarks || `Payout settled with reference ${payoutReference}`,
      evaluationMeta: {
        source: 'team2_payout_orchestrator',
        payoutReference,
        timestamp: new Date().toISOString(),
      },
    });

    if (!transition.ok) {
      return res.status(409).json({ success: false, ...transition.error });
    }

    const claim = await Claim.findByIdAndUpdate(
      req.params.id,
      {
        approvedAmount: Number(paidAmount ?? existingClaim.approvedAmount ?? existingClaim.claimAmount ?? 0),
        remarks: remarks || `Payout transferred (${payoutReference})`,
        ...transition.patch,
      },
      { new: true },
    );

    return res.json({ success: true, claim });
  } catch (err) {
    console.error('markClaimPaid error:', err);
    return res.status(500).json({ success: false, message: 'Failed to mark claim as paid' });
  }
};
