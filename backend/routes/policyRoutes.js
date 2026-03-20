const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policyController');
const { protect } = require('../middleware/authMiddleware');

// All policy routes require authentication
router.use(protect);

router.get('/', policyController.getPolicies);
router.post('/', policyController.createPolicy);
router.post('/quote', policyController.getQuote);         // Must be before /:id
router.get('/:id', policyController.getPolicy);
router.patch('/:id/cancel', policyController.cancelPolicy);
router.post('/:id/trigger', policyController.fireTrigger); // Oracle / test endpoint

module.exports = router;
