const axios = require('axios');

const ALERT_WEBHOOK_URL = process.env.TEAM2_ALERT_WEBHOOK_URL || '';
const ALERT_COOLDOWN_MS = Number(process.env.TEAM2_ALERT_COOLDOWN_MS || 5 * 60 * 1000);

const lastSentByKey = new Map();

const shouldThrottle = (key) => {
  const now = Date.now();
  const previous = lastSentByKey.get(key) || 0;
  if (now - previous < ALERT_COOLDOWN_MS) {
    return true;
  }
  lastSentByKey.set(key, now);
  return false;
};

const sendOpsAlert = async ({ key = 'generic', severity = 'warning', message, payload = {} }) => {
  if (!message) {
    return { delivered: false, channel: 'none', throttled: false };
  }

  if (shouldThrottle(key)) {
    return { delivered: false, channel: 'throttled', throttled: true };
  }

  const body = {
    service: 'team2-orchestrator',
    severity,
    message,
    payload,
    timestamp: new Date().toISOString(),
  };

  if (!ALERT_WEBHOOK_URL) {
    console.warn(`[TEAM2_ALERT/${severity}] ${message}`, payload);
    return { delivered: false, channel: 'log', throttled: false };
  }

  try {
    await axios.post(ALERT_WEBHOOK_URL, body, { timeout: 3000 });
    return { delivered: true, channel: 'webhook', throttled: false };
  } catch (err) {
    console.error('team2 alert delivery failed:', err.message);
    return { delivered: false, channel: 'webhook', throttled: false, error: err.message };
  }
};

module.exports = {
  sendOpsAlert,
};
