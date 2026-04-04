const { body, param, query } = require('express-validator');

const TRIGGER_TYPES = ['rainfall', 'vehicle_accident', 'platform_outage', 'hospitalization'];

const policyIdParamSchema = [param('id').isMongoId().withMessage('valid policy id is required')];

const createPolicySchema = [
  body('type').optional().isIn(['weekly', 'daily']).withMessage('type must be weekly or daily'),
  body('coverageAmount').isFloat({ min: 100, max: 10000000 }).withMessage('coverageAmount must be between 100 and 10000000'),
  body('triggerConfig').optional({ nullable: true }).isArray({ min: 1 }).withMessage('triggerConfig must be a non-empty array'),
  body('triggerConfig.*.type').optional().isIn(TRIGGER_TYPES).withMessage('invalid trigger type in triggerConfig'),
  body('triggerConfig.*.threshold').optional().isFloat({ min: 0 }),
  body('triggerConfig.*.payoutRatio').optional().isFloat({ min: 0, max: 1 }),
];

const quoteSchema = [
  body('weeklyDeliveries').isInt({ min: 0, max: 1000 }).withMessage('weeklyDeliveries must be between 0 and 1000'),
  body('platform').isIn(['swiggy', 'zomato', 'blinkit', 'dunzo', 'other']).withMessage('invalid platform'),
  body('riskScore').optional({ nullable: true }).isFloat({ min: 0, max: 1 }).withMessage('riskScore must be between 0 and 1'),
];

const weatherLookupSchema = [
  body('weatherLookup').optional({ nullable: true }).isObject().withMessage('weatherLookup must be an object'),
  body('weatherLookup.latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('weatherLookup.longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('weatherLookup.observedAt').optional({ nullable: true }).isISO8601().withMessage('weatherLookup.observedAt must be an ISO date'),
];

const triggerSchema = [
  ...policyIdParamSchema,
  body('triggerType').isIn(TRIGGER_TYPES).withMessage('invalid triggerType'),
  body('triggerValue').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('triggerValue must be a non-negative number'),
  body('exclusionCode').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('eventCategory').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  ...weatherLookupSchema,
  body().custom((payload) => {
    const hasTriggerValue = payload.triggerValue !== undefined && payload.triggerValue !== null;
    const hasCoords = payload.weatherLookup && payload.weatherLookup.latitude != null && payload.weatherLookup.longitude != null;

    if (!hasTriggerValue && !(payload.triggerType === 'rainfall' && hasCoords)) {
      throw new Error('triggerValue is required unless rainfall weatherLookup coordinates are provided');
    }
    return true;
  }),
];

const policyListQuerySchema = [
  query('status').optional().isIn(['active', 'expired', 'cancelled']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

module.exports = {
  createPolicySchema,
  quoteSchema,
  triggerSchema,
  policyIdParamSchema,
  policyListQuerySchema,
};
