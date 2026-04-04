const { body, param, query } = require('express-validator');

const TRIGGER_TYPES = ['rainfall', 'vehicle_accident', 'platform_outage', 'hospitalization'];

const claimIdParamSchema = [param('id').isMongoId().withMessage('valid claim id is required')];

const weatherLookupSchema = [
  body('weatherLookup').optional({ nullable: true }).isObject().withMessage('weatherLookup must be an object'),
  body('weatherLookup.latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('weatherLookup.longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('weatherLookup.observedAt').optional({ nullable: true }).isISO8601().withMessage('weatherLookup.observedAt must be an ISO date'),
];

const createClaimSchema = [
  body('policyId').isString().trim().notEmpty().withMessage('policyId is required'),
  body('triggerType').isIn(TRIGGER_TYPES).withMessage('invalid triggerType'),
  body('triggerValue').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('triggerValue must be a non-negative number'),
  body('documents').optional({ nullable: true }).isArray().withMessage('documents must be an array'),
  body('documents.*').optional().isString(),
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

const claimListQuerySchema = [
  query('status').optional().isIn(['pending', 'under_review', 'approved', 'rejected', 'paid']),
];

const approveClaimSchema = [
  ...claimIdParamSchema,
  body('approvedAmount').isFloat({ min: 0 }).withMessage('approvedAmount must be a non-negative number'),
  body('remarks').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
];

const rejectClaimSchema = [
  ...claimIdParamSchema,
  body('remarks').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
];

const markPaidSchema = [
  ...claimIdParamSchema,
  body('payoutReference').isString().trim().notEmpty().isLength({ max: 120 }).withMessage('payoutReference is required'),
  body('remarks').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
  body('paidAmount').optional({ nullable: true }).isFloat({ min: 0 }),
];

module.exports = {
  claimIdParamSchema,
  createClaimSchema,
  claimListQuerySchema,
  approveClaimSchema,
  rejectClaimSchema,
  markPaidSchema,
};
