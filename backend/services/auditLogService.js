const AuditLog = require('../models/AuditLog');

const REDACTED_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'jwt',
  'secret',
  'accessToken',
  'refreshToken',
]);

const sanitizeForAudit = (value, depth = 0) => {
  if (value == null) return value;
  if (depth > 4) return '[truncated]';

  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeForAudit(item, depth + 1));
  }

  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, nestedValue]) => {
      if (REDACTED_KEYS.has(String(key).toLowerCase())) {
        acc[key] = '[redacted]';
      } else {
        acc[key] = sanitizeForAudit(nestedValue, depth + 1);
      }
      return acc;
    }, {});
  }

  return value;
};

const writeAuditLog = async (entry) => {
  try {
    await AuditLog.create(entry);
  } catch (err) {
    console.error('audit log write failed:', err.message);
  }
};

module.exports = {
  sanitizeForAudit,
  writeAuditLog,
};
