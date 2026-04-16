const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

/**
 * All chat routes require authentication.
 */
router.use(protect);

router.post('/message', chatController.sendMessage);
router.get('/history', chatController.getHistory);

module.exports = router;
