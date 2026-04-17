const HazardZone = require('../models/HazardZone');
const LocationPing = require('../models/LocationPing');
const { filterAndInsert, triggerKinematicCheck } = require('../services/locationIngestionService');
const { validateWorkerInZone } = require('../services/zoneValidatorService');
const { processHazardEvent } = require('../services/proactivePayoutService');

exports.ingestPings = async (req, res) => {
  try {
    const { pings } = req.body;
    const { saved, discarded } = await filterAndInsert(req.user.id, pings);

    triggerKinematicCheck(req.user.id, pings).catch((err) => {
      console.warn(`Kinematic check failed for worker ${req.user.id}:`, err.message);
    });

    res.status(201).json({
      success: true,
      saved,
      discarded,
      message: `${saved} ping(s) saved, ${discarded} discarded`,
    });
  } catch (err) {
    console.error('ingestPings error:', err);
    res.status(500).json({ success: false, message: 'Failed to save location pings' });
  }
};

exports.validateZone = async (req, res) => {
  try {
    const { workerId, eventPolygon, timeWindow } = req.body;
    const result = await validateWorkerInZone(workerId, eventPolygon, timeWindow);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('validateZone error:', err);
    res.status(500).json({ success: false, message: 'Zone validation failed' });
  }
};

exports.getPingCount = async (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ success: false, message: 'start and end are required' });
    }

    const parsedStart = new Date(start);
    const parsedEnd = new Date(end);

    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ success: false, message: 'start and end must be valid ISO timestamps' });
    }

    if (parsedEnd <= parsedStart) {
      return res.status(400).json({ success: false, message: 'end must be after start' });
    }

    const pingCount = await LocationPing.countDocuments({
      workerId: req.user.id,
      timestamp: {
        $gte: parsedStart,
        $lte: parsedEnd,
      },
    });

    res.json({
      success: true,
      pingCount,
      timeWindow: {
        start: parsedStart.toISOString(),
        end: parsedEnd.toISOString(),
      },
    });
  } catch (err) {
    console.error('getPingCount error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch location ping count' });
  }
};

exports.createHazardZone = async (req, res) => {
  try {
    const { zoneId, name, hazardType, boundary, riskMultiplier, isActive, city, notes } = req.body;
    const zone = await HazardZone.findOneAndUpdate(
      { zoneId },
      { zoneId, name, hazardType, boundary, riskMultiplier, isActive, city, notes },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );

    res.status(201).json({ success: true, zone });
  } catch (err) {
    console.error('createHazardZone error:', err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: 'Failed to create hazard zone' });
  }
};

exports.listHazardZones = async (req, res) => {
  try {
    const { hazardType, isActive } = req.query;
    const filter = {};
    if (hazardType) filter.hazardType = hazardType;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const zones = await HazardZone.find(filter).sort({ updatedAt: -1 }).lean();
    res.json({ success: true, zones });
  } catch (err) {
    console.error('listHazardZones error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch hazard zones' });
  }
};

exports.processHazardEvent = async (req, res) => {
  try {
    const { zoneId, triggerType, triggerValue, timeWindow, eventMeta } = req.body;
    const result = await processHazardEvent({
      zoneId,
      triggerType,
      triggerValue: Number(triggerValue),
      timeWindow,
      eventMeta: eventMeta ?? {},
    });

    res.json({ success: true, result });
  } catch (err) {
    console.error('processHazardEvent error:', err);
    res.status(err.message.includes('not found') ? 404 : 500).json({
      success: false,
      message: err.message || 'Failed to process hazard event',
    });
  }
};
