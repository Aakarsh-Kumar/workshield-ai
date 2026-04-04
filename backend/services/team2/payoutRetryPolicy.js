const { RETRY_CONFIG } = require('../../constants/team2Payout');

const jitterFactor = () => 0.9 + Math.random() * 0.2;

const computeRetryDelayMs = (attemptCount) => {
  const exponent = Math.max(0, attemptCount - 1);
  const baseDelay = RETRY_CONFIG.BASE_DELAY_MS * (2 ** exponent);
  const delayWithCap = Math.min(baseDelay, RETRY_CONFIG.MAX_DELAY_MS);
  return Math.floor(delayWithCap * jitterFactor());
};

const shouldRetry = ({ transient, attemptCount, firstAttemptAt }) => {
  if (!transient) return false;
  if (attemptCount >= RETRY_CONFIG.MAX_ATTEMPTS) return false;
  if (!firstAttemptAt) return true;

  const withinWindow = Date.now() - new Date(firstAttemptAt).getTime() <= RETRY_CONFIG.RETRY_WINDOW_MS;
  return withinWindow;
};

module.exports = {
  computeRetryDelayMs,
  shouldRetry,
};
