const { body } = require('express-validator');

const ALLOWED_PLATFORMS = ['swiggy', 'zomato', 'blinkit', 'dunzo', 'other'];

const registerSchema = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('name must be 2 to 80 characters long'),
  body('email').isEmail().withMessage('valid email is required').normalizeEmail(),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .withMessage('password must be at least 8 characters long')
    .matches(/[A-Z]/)
    .withMessage('password must include at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('password must include at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('password must include at least one digit'),
  body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
  body('platform').optional({ nullable: true }).isIn(ALLOWED_PLATFORMS).withMessage('invalid platform'),
  body('weeklyDeliveries')
    .optional({ nullable: true })
    .isInt({ min: 0, max: 1000 })
    .withMessage('weeklyDeliveries must be between 0 and 1000'),
];

const loginSchema = [
  body('email').isEmail().withMessage('valid email is required').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('password is required'),
];

const updateProfileSchema = [
  body('name').optional({ nullable: true }).trim().isLength({ min: 2, max: 80 }),
  body('phone').optional({ nullable: true }).isString().trim().isLength({ max: 20 }),
  body('platform').optional({ nullable: true }).isIn(ALLOWED_PLATFORMS).withMessage('invalid platform'),
  body('weeklyDeliveries').optional({ nullable: true }).isInt({ min: 0, max: 1000 }),
  body().custom((payload) => {
    const keys = ['name', 'phone', 'platform', 'weeklyDeliveries'];
    if (!keys.some((key) => payload[key] !== undefined)) {
      throw new Error('At least one profile field must be supplied');
    }
    return true;
  }),
];

module.exports = {
  registerSchema,
  loginSchema,
  updateProfileSchema,
};
