const PAYOUT_ATTEMPT_STATUS = Object.freeze({
  QUEUED: 'queued',
  PROCESSING: 'processing',
  PROVIDER_SUCCESS: 'provider_success',
  CALLBACK_CONFIRMED: 'callback_confirmed',
  RETRY_SCHEDULED: 'retry_scheduled',
  FAILED_TRANSIENT: 'failed_transient',
  FAILED_TERMINAL: 'failed_terminal',
  CONFLICT: 'conflict',
});

const PROVIDER_MODES = Object.freeze({
  MOCK: 'mock',
  SANDBOX: 'sandbox',
});

const RETRY_CONFIG = Object.freeze({
  MAX_ATTEMPTS: Number(process.env.TEAM2_MAX_RETRY_ATTEMPTS || 5),
  RETRY_WINDOW_MS: Number(process.env.TEAM2_RETRY_WINDOW_MS || 24 * 60 * 60 * 1000),
  BASE_DELAY_MS: Number(process.env.TEAM2_RETRY_BASE_MS || 30 * 1000),
  MAX_DELAY_MS: Number(process.env.TEAM2_RETRY_MAX_MS || 60 * 60 * 1000),
});

const isTransientHttpStatus = (statusCode) => statusCode === 429 || (statusCode >= 500 && statusCode <= 599);

module.exports = {
  PAYOUT_ATTEMPT_STATUS,
  PROVIDER_MODES,
  RETRY_CONFIG,
  isTransientHttpStatus,
};
