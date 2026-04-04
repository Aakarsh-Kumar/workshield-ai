const { body, param, query } = require('express-validator');

const runPayoutCycleSchema = [
  body('limit').optional({ nullable: true }).isInt({ min: 1, max: 500 }).withMessage('limit must be between 1 and 500'),
];

const manualReviewDecisionSchema = [
  param('id').isMongoId().withMessage('valid claim id is required'),
  body('action').isIn(['approve', 'reject']).withMessage('action must be approve or reject'),
  body('approvedAmount').optional({ nullable: true }).isFloat({ min: 0 }),
  body('remarks').optional({ nullable: true }).isString().trim().isLength({ max: 1000 }),
];

const payoutAttemptsQuerySchema = [
  query('status').optional().isIn([
    'queued',
    'processing',
    'provider_success',
    'callback_confirmed',
    'retry_scheduled',
    'failed_transient',
    'failed_terminal',
    'conflict',
  ]),
  query('limit').optional().isInt({ min: 1, max: 200 }),
];

const manualReviewQueueQuerySchema = [
  query('limit').optional().isInt({ min: 1, max: 200 }),
];

const auditLogsQuerySchema = [
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('action').optional().isString().trim().isLength({ max: 180 }),
  query('actorRole').optional().isString().trim().isLength({ max: 40 }),
  query('pathContains').optional().isString().trim().isLength({ max: 180 }),
];

module.exports = {
  runPayoutCycleSchema,
  manualReviewDecisionSchema,
  payoutAttemptsQuerySchema,
  manualReviewQueueQuerySchema,
  auditLogsQuerySchema,
};
