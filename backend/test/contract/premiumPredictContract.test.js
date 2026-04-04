const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.WORKSHIELD_BASE_URL || 'http://localhost';

test('premium predict endpoint is model-backed and contract-stable', async () => {
  const payload = {
    weekly_deliveries: 30,
    platform: 'swiggy',
    risk_score: 0.4,
  };

  const res = await fetch(`${BASE_URL}/ai/predict`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.ok, true);
  const body = await res.json();

  assert.equal(typeof body.premium, 'number');
  assert.equal(body.premium > 0, true);
  assert.equal(body.currency, 'INR');
  assert.equal(typeof body.breakdown, 'object');

  assert.equal(body.breakdown.mode, 'model');
  assert.equal(typeof body.breakdown.model_version, 'string');
  assert.equal(typeof body.breakdown.predicted_risk_score, 'number');
  assert.equal(typeof body.breakdown.feature_vector, 'object');
});

test('premium model status endpoint reports model mode', async () => {
  const res = await fetch(`${BASE_URL}/ai/premium-model-status`);
  assert.equal(res.ok, true);

  const body = await res.json();
  assert.equal(body.mode, 'model');
  assert.equal(typeof body.model_version, 'string');
  assert.equal(body.registry_found, true);
});
