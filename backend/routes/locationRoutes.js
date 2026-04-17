const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/locationController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/requestValidation');
const { locationPingsLimiter } = require('../middleware/rateLimiters');
const {
  ingestPingsSchema,
  validateZoneSchema,
  createHazardZoneSchema,
  hazardEventSchema,
} = require('../validators/locationValidators');

router.use(protect);

router.post('/pings', locationPingsLimiter, validate(ingestPingsSchema), ctrl.ingestPings);
router.get('/pings/count', ctrl.getPingCount);
router.post('/validate-zone', requireAdmin, validate(validateZoneSchema), ctrl.validateZone);
router.get('/hazard-zones', requireAdmin, ctrl.listHazardZones);
router.post('/hazard-zones', requireAdmin, validate(createHazardZoneSchema), ctrl.createHazardZone);
router.post('/hazard-event', requireAdmin, validate(hazardEventSchema), ctrl.processHazardEvent);

module.exports = router;
