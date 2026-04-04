const express = require('express');
const router = express.Router();
const claimController = require('../controllers/claimController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

// All claim routes require authentication
router.use(protect);

router.get('/', claimController.getClaims);
router.post('/', claimController.createClaim);
router.get('/:id', claimController.getClaim);

// Admin-only actions
router.patch('/:id/approve', requireAdmin, claimController.approveClaim);
router.patch('/:id/reject', requireAdmin, claimController.rejectClaim);
router.patch('/:id/paid', requireAdmin, claimController.markClaimPaid);

module.exports = router;
