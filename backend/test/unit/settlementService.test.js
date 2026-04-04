const test = require('node:test');
const assert = require('node:assert/strict');

const { buildTransition, canTransition } = require('../../services/settlementService');
const { REASON_CODES, SETTLEMENT_STATUS } = require('../../constants/decisionContract');

test('canTransition allows required forward transitions', () => {
  assert.equal(canTransition(SETTLEMENT_STATUS.PENDING, SETTLEMENT_STATUS.APPROVED), true);
  assert.equal(canTransition(SETTLEMENT_STATUS.PENDING, SETTLEMENT_STATUS.SOFT_FLAG), true);
  assert.equal(canTransition(SETTLEMENT_STATUS.PENDING, SETTLEMENT_STATUS.HARD_BLOCK), true);
  assert.equal(canTransition(SETTLEMENT_STATUS.APPROVED, SETTLEMENT_STATUS.PAID), true);
});

test('canTransition rejects invalid transitions', () => {
  assert.equal(canTransition(SETTLEMENT_STATUS.PAID, SETTLEMENT_STATUS.APPROVED), false);
  assert.equal(canTransition(SETTLEMENT_STATUS.HARD_BLOCK, SETTLEMENT_STATUS.APPROVED), false);
});

test('buildTransition returns structured invalid-transition error', () => {
  const result = buildTransition({
    currentStatus: SETTLEMENT_STATUS.PAID,
    targetStatus: SETTLEMENT_STATUS.APPROVED,
    reasonCode: REASON_CODES.MANUAL_APPROVAL,
    reasonDetail: 'Invalid test',
    evaluationMeta: {},
  });

  assert.equal(result.ok, false);
  assert.equal(result.error.reasonCode, REASON_CODES.INVALID_TRANSITION);
  assert.match(result.error.reasonDetail, /Invalid transition/);
  assert.equal(result.error.settlementStatus, SETTLEMENT_STATUS.PAID);
});

test('buildTransition maps pending -> soft_flag to under_review workflow state', () => {
  const result = buildTransition({
    currentStatus: SETTLEMENT_STATUS.PENDING,
    targetStatus: SETTLEMENT_STATUS.SOFT_FLAG,
    reasonCode: REASON_CODES.FRAUD_SOFT_FLAG,
    reasonDetail: 'Manual review needed',
    evaluationMeta: { source: 'test' },
  });

  assert.equal(result.ok, true);
  assert.equal(result.patch.status, 'under_review');
  assert.equal(result.patch.settlementStatus, SETTLEMENT_STATUS.SOFT_FLAG);
  assert.equal(result.patch.payoutEligibility, false);
});
