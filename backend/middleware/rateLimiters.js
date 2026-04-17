const rateLimit = require('express-rate-limit');

const shouldSkip = () => process.env.NODE_ENV === 'test' || process.env.DISABLE_RATE_LIMIT === 'true';

const baseConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
};

const apiLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_API_MAX || 400),
  message: { success: false, message: 'Too many requests. Please retry shortly.' },
});

const authLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX || 30),
  message: { success: false, message: 'Too many authentication attempts. Please retry later.' },
});

const claimWriteLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_CLAIM_WRITE_MAX || 90),
  message: { success: false, message: 'Claim write limit reached. Please retry later.' },
});

const team2OpsLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_TEAM2_MAX || 180),
  message: { success: false, message: 'Team 2 operation rate limit reached. Please retry later.' },
});

const locationPingsLimiter = rateLimit({
  ...baseConfig,
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_LOCATION_MAX || 200),
  message: { success: false, message: 'Location ping rate limit reached.' },
});

module.exports = {
  apiLimiter,
  authLimiter,
  claimWriteLimiter,
  team2OpsLimiter,
  locationPingsLimiter,
};
