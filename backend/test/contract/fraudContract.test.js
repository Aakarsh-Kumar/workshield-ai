const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.WORKSHIELD_BASE_URL || 'http://localhost';

test('fraud endpoint returns Team 2 contract fields', async () => {
  const payload = {
    claim_id: 'contract-check-1',
    event_ts: new Date().toISOString(),
    trigger_type: 'rainfall',
    trigger_value: 65,
    claim_amount: 1200,
    coverage_amount: 2000,
    trigger_threshold: 50,
    trigger_gap_ratio: 0.3,
    payout_ratio: 0.5,
    income_loss_estimate: 900,
    weather_severity: 2,
    gps_distance_to_event_zone_km: 0,
    active_hours_overlap_ratio: 0.9,
    recent_claims_same_zone_24h: 0,
    recent_claims_same_device_24h: 0,
    recent_claims_same_ip_24h: 0,
    device_rooted_flag: 0,
    mock_location_flag: 0,
    gps_speed_jump_flag: 0,
    policy_exclusion_hit_flag: 0,
    policy_age_days: 20,
    policy_age_hours: 480,
    platform: 'swiggy',
  };

  const res = await fetch(`${BASE_URL}/ai/fraud-check`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.ok, true);
  const body = await res.json();

  assert.equal(typeof body.verdict, 'string');
  assert.equal(typeof body.reasonCode, 'string');
  assert.equal(typeof body.reasonDetail, 'string');
  assert.equal(typeof body.fraudScore, 'number');
  assert.equal(typeof body.settlementStatus, 'string');
  assert.equal(typeof body.payoutEligibility, 'boolean');
  assert.equal(typeof body.evaluationMeta, 'object');

  assert.equal(body.fraudScore >= 0 && body.fraudScore <= 1, true);

  if (body.verdict === 'hard_block') {
    assert.equal(body.settlementStatus, 'hard_block');
    assert.equal(body.payoutEligibility, false);
  }
});
