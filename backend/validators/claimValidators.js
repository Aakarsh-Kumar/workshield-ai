const { body, param, query } = require('express-validator');

const TRIGGER_TYPES = ['rainfall', 'vehicle_accident', 'platform_outage', 'hospitalization', 'traffic_congestion'];

const claimIdParamSchema = [param('id').isMongoId().withMessage('valid claim id is required')];

const weatherLookupSchema = [
  body('weatherLookup').optional({ nullable: true }).isObject().withMessage('weatherLookup must be an object'),
  body('weatherLookup.latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }),
  body('weatherLookup.longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }),
  body('weatherLookup.observedAt').optional({ nullable: true }).isISO8601().withMessage('weatherLookup.observedAt must be an ISO date'),
];

const polygonSchema = [
  body('eventPolygon').optional({ nullable: true }).isObject().withMessage('eventPolygon must be an object'),
  body('eventPolygon.type').optional({ nullable: true }).isIn(['Polygon', 'MultiPolygon']),
  body('eventPolygon.coordinates').optional({ nullable: true }).isArray({ min: 1 }),
  body('timeWindow').optional({ nullable: true }).isObject().withMessage('timeWindow must be an object'),
  body('timeWindow.start').optional({ nullable: true }).isISO8601().withMessage('timeWindow.start must be an ISO date'),
  body('timeWindow.end').optional({ nullable: true }).isISO8601().withMessage('timeWindow.end must be an ISO date'),
];

const createClaimSchema = [
  body('policyId').isString().trim().notEmpty().withMessage('policyId is required'),
  body('triggerType').isIn(TRIGGER_TYPES).withMessage('invalid triggerType'),
  body('triggerValue').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('triggerValue must be a non-negative number'),
  body('documents').optional({ nullable: true }).isArray().withMessage('documents must be an array'),
  body('documents.*').optional().isObject().withMessage('each document must be an object'),
  body('documents.*.content_base64').optional({ nullable: true }).isString(),
  body('documents.*.mime_type').optional({ nullable: true }).isString(),
  body('documents.*.file_name').optional({ nullable: true }).isString(),
  body('exclusionCode').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  body('eventCategory').optional({ nullable: true }).isString().trim().isLength({ max: 120 }),
  ...weatherLookupSchema,
  ...polygonSchema,
  body().custom((payload) => {
    const hasTriggerValue = payload.triggerValue !== undefined && payload.triggerValue !== null;
    const triggerType = payload.triggerType;
    const documents = Array.isArray(payload.documents) ? payload.documents : [];
    const hasTimeWindow = Boolean(payload.timeWindow?.start && payload.timeWindow?.end);

    if ((triggerType === 'vehicle_accident' || triggerType === 'hospitalization') && !hasTriggerValue) {
      throw new Error('triggerValue is required for document-based claims');
    }

    if ((triggerType === 'vehicle_accident' || triggerType === 'hospitalization') && documents.length === 0) {
      throw new Error('At least one supporting document is required for this claim type');
    }

    if ((triggerType === 'platform_outage' || triggerType === 'traffic_congestion') && !hasTimeWindow) {
      throw new Error('timeWindow start and end are required for this claim type');
    }

    return true;
  }),
];

const claimListQuerySchema = [
  query('status').optional().isIn(['pending', 'under_review', 'approved', 'rejected', 'paid']),
  query('scope').optional().isIn(['mine', 'all']),
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
