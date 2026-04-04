const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/requestValidation');
const { authLimiter } = require('../middleware/rateLimiters');
const { registerSchema, loginSchema, updateProfileSchema } = require('../validators/authValidators');

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// Protected
router.get('/me', protect, authController.getMe);
router.patch('/profile', protect, validate(updateProfileSchema), authController.updateProfile);

module.exports = router;
