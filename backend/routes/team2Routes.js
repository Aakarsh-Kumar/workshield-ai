const express = require('express');
const router = express.Router();
const team2Controller = require('../controllers/team2Controller');
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/requestValidation');
const { team2OpsLimiter } = require('../middleware/rateLimiters');
const {
	runPayoutCycleSchema,
	manualReviewDecisionSchema,
	payoutAttemptsQuerySchema,
	manualReviewQueueQuerySchema,
	auditLogsQuerySchema,
} = require('../validators/team2Validators');

router.use(protect, requireAdmin);

router.get('/ops/summary', team2Controller.getOpsSummary);
router.get('/ops/scheduler', team2Controller.getSchedulerStatus);
router.post('/ops/reconcile', team2OpsLimiter, team2Controller.runReconciliation);
router.get('/ops/audit-logs', validate(auditLogsQuerySchema), team2Controller.getAuditLogs);
router.get('/review-queue', validate(manualReviewQueueQuerySchema), team2Controller.getManualReviewQueue);
router.post('/review/:id/decision', team2OpsLimiter, validate(manualReviewDecisionSchema), team2Controller.applyManualReviewDecision);
router.post('/payouts/run', team2OpsLimiter, validate(runPayoutCycleSchema), team2Controller.runPayoutCycle);
router.get('/payouts/attempts', validate(payoutAttemptsQuerySchema), team2Controller.getPayoutAttempts);

module.exports = router;
