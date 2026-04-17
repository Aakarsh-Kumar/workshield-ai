const { body } = require('express-validator');

const HAZARD_TYPES = ['FLOOD', 'CYCLONE', 'HEATWAVE', 'LANDSLIDE'];
const TRIGGER_TYPES = ['rainfall', 'vehicle_accident', 'platform_outage', 'hospitalization', 'traffic_congestion'];

const polygonSchema = (prefix) => [
  body(`${prefix}.type`)
    .isIn(['Polygon', 'MultiPolygon'])
    .withMessage(`${prefix}.type must be Polygon or MultiPolygon`),
  body(`${prefix}.coordinates`).isArray({ min: 1 }).withMessage(`${prefix}.coordinates must be an array`),
];

const ingestPingsSchema = [
  body('pings').isArray({ min: 1, max: 200 }).withMessage('pings must contain 1 to 200 items'),
  body('pings.*.timestamp').isISO8601().withMessage('ping timestamp must be ISO8601'),
  body('pings.*.coordinates').isArray({ min: 2, max: 2 }).withMessage('ping coordinates must be [lng, lat]'),
  body('pings.*.coordinates.0').isFloat({ min: -180, max: 180 }),
  body('pings.*.coordinates.1').isFloat({ min: -90, max: 90 }),
  body('pings.*.accuracy').isFloat({ min: 0 }).withMessage('ping accuracy must be non-negative'),
  body('pings.*.speed').optional({ nullable: true }).isFloat({ min: 0 }),
  body('pings.*.isOfflineSync').optional({ nullable: true }).isBoolean(),
  body('pings.*.telemetry').optional({ nullable: true }).isObject(),
  body('pings.*.telemetry.sessionId').optional({ nullable: true }).isString().trim().isLength({ min: 1, max: 120 }),
  body('pings.*.telemetry.deviceId').optional({ nullable: true }).isString().trim().isLength({ min: 1, max: 120 }),
  body('pings.*.telemetry.userAgent').optional({ nullable: true }).isString().trim().isLength({ max: 512 }),
  body('pings.*.telemetry.platform').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('pings.*.telemetry.language').optional({ nullable: true }).isString().trim().isLength({ max: 48 }),
  body('pings.*.telemetry.timezone').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('pings.*.telemetry.timezoneOffsetMinutes').optional({ nullable: true }).isInt({ min: -840, max: 840 }),
  body('pings.*.telemetry.online').optional({ nullable: true }).isBoolean(),
  body('pings.*.telemetry.visibilityState').optional({ nullable: true }).isString().trim().isLength({ max: 32 }),
  body('pings.*.telemetry.hardwareConcurrency').optional({ nullable: true }).isInt({ min: 1, max: 256 }),
  body('pings.*.telemetry.deviceMemoryGb').optional({ nullable: true }).isFloat({ min: 0, max: 2048 }),
  body('pings.*.telemetry.maxTouchPoints').optional({ nullable: true }).isInt({ min: 0, max: 32 }),
];

const validateZoneSchema = [
  body('workerId').isMongoId().withMessage('workerId must be a valid Mongo id'),
  ...polygonSchema('eventPolygon'),
  body('timeWindow').isObject().withMessage('timeWindow is required'),
  body('timeWindow.start').isISO8601().withMessage('timeWindow.start must be ISO8601'),
  body('timeWindow.end').isISO8601().withMessage('timeWindow.end must be ISO8601'),
];

const createHazardZoneSchema = [
  body('zoneId').isString().trim().notEmpty().withMessage('zoneId is required'),
  body('name').isString().trim().notEmpty().withMessage('name is required'),
  body('city').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('notes').optional({ nullable: true }).isString().trim().isLength({ max: 2000 }),
  body('hazardType').isIn(HAZARD_TYPES).withMessage('invalid hazardType'),
  ...polygonSchema('boundary'),
  body('riskMultiplier').optional({ nullable: true }).isFloat({ min: 0.1, max: 5.0 }),
  body('isActive').optional({ nullable: true }).isBoolean(),
];

const hazardEventSchema = [
  body('zoneId').isString().trim().notEmpty().withMessage('zoneId is required'),
  body('triggerType').isIn(TRIGGER_TYPES).withMessage('invalid triggerType'),
  body('triggerValue').isFloat({ min: 0 }).withMessage('triggerValue must be non-negative'),
  body('timeWindow').isObject().withMessage('timeWindow is required'),
  body('timeWindow.start').isISO8601().withMessage('timeWindow.start must be ISO8601'),
  body('timeWindow.end').isISO8601().withMessage('timeWindow.end must be ISO8601'),
  body('eventMeta').optional({ nullable: true }).isObject(),
];

module.exports = {
  ingestPingsSchema,
  validateZoneSchema,
  createHazardZoneSchema,
  hazardEventSchema,
};
