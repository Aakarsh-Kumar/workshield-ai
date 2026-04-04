const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.WORKSHIELD_BASE_URL || 'http://localhost';

const runFraudCheck = async (claimId, overrides = {}) => {
  const payload = {
    claim_id: claimId,
    event_ts: new Date().toISOString(),
    trigger_type: 'rainfall',
    trigger_value: 55,
    claim_amount: 1200,
    coverage_amount: 2000,
    trigger_threshold: 50,
    trigger_gap_ratio: 0.1,
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
    ...overrides,
  };

  const res = await fetch(`${BASE_URL}/ai/fraud-check`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.ok, true);
  return res.json();
};

test('fraud bucket sanity: low remains auto_approve', async () => {
  const body = await runFraudCheck('bucket-low', {
    policy_age_hours: 200,
    claim_amount: 300,
    gps_distance_to_event_zone_km: 0.2,
    active_hours_overlap_ratio: 0.9,
    recent_claims_same_device_24h: 0,
    recent_claims_same_ip_24h: 0,
    weather_severity: 1,
  });

  assert.equal(body.verdict, 'auto_approve');
  assert.equal(body.settlementStatus, 'approved');
});

test('fraud bucket sanity: medium escalates to soft_flag in balanced mode', async () => {
  const body = await runFraudCheck('bucket-medium', {
    policy_age_hours: 30,
    claim_amount: 4000,
    gps_distance_to_event_zone_km: 8,
    active_hours_overlap_ratio: 0.4,
    recent_claims_same_device_24h: 2,
    recent_claims_same_ip_24h: 3,
    weather_severity: 2,
    trigger_value: 50.5,
  });

  assert.equal(body.verdict, 'soft_flag');
  assert.equal(body.settlementStatus, 'soft_flag');
});

test('fraud bucket sanity: high remains hard_block', async () => {
  const body = await runFraudCheck('bucket-high', {
    policy_age_hours: 2,
    claim_amount: 15000,
    gps_distance_to_event_zone_km: 25,
    active_hours_overlap_ratio: 0.05,
    recent_claims_same_device_24h: 5,
    recent_claims_same_ip_24h: 7,
    device_rooted_flag: 1,
    mock_location_flag: 1,
    gps_speed_jump_flag: 1,
    policy_exclusion_hit_flag: 1,
    weather_severity: 4,
    trigger_value: 50.1,
  });

  assert.equal(body.verdict, 'hard_block');
  assert.equal(body.settlementStatus, 'hard_block');
  assert.equal(body.payoutEligibility, false);
});
