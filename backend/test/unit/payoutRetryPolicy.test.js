const test = require('node:test');
const assert = require('node:assert/strict');

const { computeRetryDelayMs, shouldRetry } = require('../../services/team2/payoutRetryPolicy');
const { RETRY_CONFIG } = require('../../constants/team2Payout');

test('computeRetryDelayMs grows with attempts and stays capped', () => {
  const d1 = computeRetryDelayMs(1);
  const d2 = computeRetryDelayMs(2);
  const d5 = computeRetryDelayMs(5);

  assert.ok(d1 > 0);
  assert.ok(d2 >= d1 * 0.8);
  assert.ok(d5 <= Math.floor(RETRY_CONFIG.MAX_DELAY_MS * 1.2));
});

test('shouldRetry only for transient failures within limits', () => {
  const firstAttemptAt = new Date();

  assert.equal(
    shouldRetry({ transient: true, attemptCount: 1, firstAttemptAt }),
    true,
  );

  assert.equal(
    shouldRetry({ transient: false, attemptCount: 1, firstAttemptAt }),
    false,
  );

  assert.equal(
    shouldRetry({ transient: true, attemptCount: RETRY_CONFIG.MAX_ATTEMPTS, firstAttemptAt }),
    false,
  );

  const staleAttempt = new Date(Date.now() - RETRY_CONFIG.RETRY_WINDOW_MS - 5_000);
  assert.equal(
    shouldRetry({ transient: true, attemptCount: 1, firstAttemptAt: staleAttempt }),
    false,
  );
});
