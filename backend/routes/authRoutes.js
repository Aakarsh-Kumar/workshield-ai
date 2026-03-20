const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected
router.get('/me', protect, authController.getMe);
router.patch('/profile', protect, authController.updateProfile);

module.exports = router;
