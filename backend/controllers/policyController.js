const { createPolicy, getPremiumPrediction } = require('../services/policyService');
const { processTriggerEvent } = require('../services/triggerService');
const { getLocationRiskMultiplier } = require('../services/riskProfileService');
const Policy = require('../models/Policy');
const { fetchRainfallMm } = require('../services/weatherService');

/**
 * POST /api/policies
 * Create a new parametric policy. Premium is calculated by the AI service.
 * Body: { type, coverageAmount, triggerConfig? }
 */
exports.createPolicy = async (req, res) => {
  try {
    const { type, coverageAmount, triggerConfig } = req.body;

    if (!coverageAmount || coverageAmount < 100) {
      return res.status(400).json({ success: false, message: 'coverageAmount must be at least 100 INR' });
    }

    const policy = await createPolicy(req.user.id, { type, coverageAmount, triggerConfig });
    res.status(201).json({ success: true, policy });
  } catch (err) {
    console.error('createPolicy error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/policies
 * List all policies belonging to the authenticated worker.
 */
exports.getPolicies = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = { userId: req.user.id };
    if (status) filter.status = status;

    const policies = await Policy.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await Policy.countDocuments(filter);
    res.json({ success: true, policies, total, page: Number(page) });
  } catch (err) {
    console.error('getPolicies error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch policies' });
  }
};

/**
 * GET /api/policies/:id
 */
exports.getPolicy = async (req, res) => {
  try {
    const policy = await Policy.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found' });
    }
    res.json({ success: true, policy });
  } catch (err) {
    console.error('getPolicy error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch policy' });
  }
};

/**
 * POST /api/policies/quote
 * Get an AI premium quote without creating a policy (for the onboarding UI).
 * Body: { weeklyDeliveries, platform, riskScore? }
 */
exports.getQuote = async (req, res) => {
  try {
    const { weeklyDeliveries, platform, riskScore, coverageAmount } = req.body;

    if (weeklyDeliveries == null || !platform || coverageAmount == null) {
      return res.status(400).json({ success: false, message: 'weeklyDeliveries, platform, and coverageAmount are required' });
    }

    const { locationRiskMultiplier, matchedZones } = await getLocationRiskMultiplier(req.user.id)
      .catch(() => ({ locationRiskMultiplier: 1.0, matchedZones: [] }));

    const premium = await getPremiumPrediction(
      Number(weeklyDeliveries),
      platform,
      Number(riskScore ?? 0.5),
      locationRiskMultiplier,
      Number(coverageAmount),
    );

    res.json({
      success: true,
      premium,
      currency: 'INR',
      locationRiskMultiplier,
      hazardZonesDetected: matchedZones.map((zone) => ({
        zoneId: zone.zoneId,
        hazardType: zone.hazardType,
        name: zone.name,
      })),
      note: 'Quote valid for 10 minutes. Actual premium may vary at issuance.',
    });
  } catch (err) {
    console.error('getQuote error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate quote' });
  }
};

/**
 * POST /api/policies/:id/trigger
 * Fire a parametric trigger event against a policy (used by oracle feeds + testing).
 * Body: { triggerType, triggerValue }
 */
exports.fireTrigger = async (req, res) => {
  try {
    const { triggerType, triggerValue, exclusionCode, eventCategory, weatherLookup } = req.body;

    if (!triggerType) {
      return res.status(400).json({ success: false, message: 'triggerType is required' });
    }

    const policy = await Policy.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Policy not found for current user' });
    }

    let observedTriggerValue = triggerValue;
    if (
      observedTriggerValue == null
      && triggerType === 'rainfall'
      && weatherLookup?.latitude != null
      && weatherLookup?.longitude != null
    ) {
      const weather = await fetchRainfallMm({
        latitude: weatherLookup.latitude,
        longitude: weatherLookup.longitude,
        observedAt: weatherLookup.observedAt,
      });
      observedTriggerValue = weather.rainfallMm;
    }

    if (observedTriggerValue == null) {
      return res.status(400).json({
        success: false,
        message: 'triggerValue is required unless rainfall weather lookup is provided',
      });
    }

    const result = await processTriggerEvent(req.params.id, triggerType, Number(observedTriggerValue), {
      exclusionCode,
      eventCategory,
    });
    res.json({ success: true, result });
  } catch (err) {
    console.error('fireTrigger error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * PATCH /api/policies/:id/cancel
 * Worker can cancel an active policy.
 */
exports.cancelPolicy = async (req, res) => {
  try {
    const policy = await Policy.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id, status: 'active' },
      { status: 'cancelled' },
      { new: true },
    );
    if (!policy) return res.status(404).json({ success: false, message: 'Active policy not found' });
    res.json({ success: true, policy });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to cancel policy' });
  }
};
