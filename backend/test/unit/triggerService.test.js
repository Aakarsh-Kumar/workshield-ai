const test = require('node:test');
const assert = require('node:assert/strict');

const {
  evaluateTrigger,
  checkExclusion,
  calculateLoss,
} = require('../../services/triggerService');
const { REASON_CODES } = require('../../constants/decisionContract');

test('evaluateTrigger marks unknown trigger type as not covered', () => {
  const policy = { triggers: [{ type: 'rainfall', threshold: 50, payoutRatio: 0.5 }] };
  const result = evaluateTrigger(policy, 'platform_outage', 5);

  assert.equal(result.triggered, false);
  assert.equal(result.reasonCode, REASON_CODES.TRIGGER_NOT_COVERED);
});

test('evaluateTrigger marks threshold miss correctly', () => {
  const policy = { triggers: [{ type: 'rainfall', threshold: 50, payoutRatio: 0.5 }] };
  const result = evaluateTrigger(policy, 'rainfall', 42);

  assert.equal(result.triggered, false);
  assert.equal(result.reasonCode, REASON_CODES.TRIGGER_THRESHOLD_NOT_MET);
  assert.match(result.reasonDetail, /not met/);
});

test('evaluateTrigger marks threshold hit correctly', () => {
  const policy = { triggers: [{ type: 'rainfall', threshold: 50, payoutRatio: 0.5 }] };
  const result = evaluateTrigger(policy, 'rainfall', 60);

  assert.equal(result.triggered, true);
  assert.equal(result.reasonCode, REASON_CODES.CLAIM_FILED);
  assert.equal(result.payoutRatio, 0.5);
});

test('checkExclusion flags hit when event category is excluded', () => {
  const policy = { exclusions: ['pandemic_epidemic', 'terrorism'] };
  const result = checkExclusion(policy, { exclusionCode: 'pandemic_epidemic' });

  assert.equal(result.hit, true);
  assert.equal(result.reasonCode, REASON_CODES.POLICY_EXCLUSION_HIT);
});

test('calculateLoss returns rounded payout amount', () => {
  const policy = { coverageAmount: 2555 };
  const payout = calculateLoss(policy, 0.3);

  assert.equal(payout, 767);
});
