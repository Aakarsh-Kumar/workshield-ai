const express = require('express');
const router = express.Router();
const claimController = require('../controllers/claimController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/requestValidation');
const { claimWriteLimiter, team2OpsLimiter } = require('../middleware/rateLimiters');
const {
	claimIdParamSchema,
	createClaimSchema,
	claimListQuerySchema,
	approveClaimSchema,
	rejectClaimSchema,
	markPaidSchema,
} = require('../validators/claimValidators');

// All claim routes require authentication
router.use(protect);

router.get('/', validate(claimListQuerySchema), claimController.getClaims);
router.post('/', claimWriteLimiter, validate(createClaimSchema), claimController.createClaim);
router.get('/:id', validate(claimIdParamSchema), claimController.getClaim);

// Admin-only actions
router.patch('/:id/approve', requireAdmin, team2OpsLimiter, validate(approveClaimSchema), claimController.approveClaim);
router.patch('/:id/reject', requireAdmin, team2OpsLimiter, validate(rejectClaimSchema), claimController.rejectClaim);
router.patch('/:id/paid', requireAdmin, team2OpsLimiter, validate(markPaidSchema), claimController.markClaimPaid);

module.exports = router;
