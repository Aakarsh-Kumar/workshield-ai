const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policyController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/requestValidation');
const { claimWriteLimiter } = require('../middleware/rateLimiters');
const {
	createPolicySchema,
	quoteSchema,
	triggerSchema,
	policyIdParamSchema,
	policyListQuerySchema,
} = require('../validators/policyValidators');

// All policy routes require authentication
router.use(protect);

router.get('/', validate(policyListQuerySchema), policyController.getPolicies);
router.post('/', claimWriteLimiter, validate(createPolicySchema), policyController.createPolicy);
router.post('/quote', claimWriteLimiter, validate(quoteSchema), policyController.getQuote);         // Must be before /:id
router.get('/:id', validate(policyIdParamSchema), policyController.getPolicy);
router.patch('/:id/cancel', claimWriteLimiter, validate(policyIdParamSchema), policyController.cancelPolicy);
router.post('/:id/trigger', claimWriteLimiter, validate(triggerSchema), policyController.fireTrigger); // Oracle / test endpoint

module.exports = router;
