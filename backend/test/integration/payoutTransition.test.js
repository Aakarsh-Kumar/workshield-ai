const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const User = require('../../models/User');

const BASE_URL = process.env.WORKSHIELD_BASE_URL || 'http://localhost';
const MONGO_URI = process.env.WORKSHIELD_MONGO_URI || 'mongodb://localhost:27017/workshield';

const uniqueEmail = () => `admin_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;

const postJson = async (url, body, headers = {}) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const payload = await res.json();
  return { res, payload };
};

test('integration: approved -> paid transition works and invalid repeat is blocked', async () => {
  const email = uniqueEmail();

  const reg = await postJson(`${BASE_URL}/api/auth/register`, {
    name: 'Payout Admin',
    email,
    password: 'Pass@1234',
    platform: 'swiggy',
    weeklyDeliveries: 20,
  });
  assert.equal(reg.res.ok, true);

  await mongoose.connect(MONGO_URI);
  await User.findByIdAndUpdate(reg.payload.user.id, { role: 'admin' });
  await mongoose.disconnect();

  const login = await postJson(`${BASE_URL}/api/auth/login`, {
    email,
    password: 'Pass@1234',
  });
  assert.equal(login.res.ok, true);
  const token = login.payload.token;

  const policyRes = await postJson(
    `${BASE_URL}/api/policies`,
    { type: 'weekly', coverageAmount: 2500 },
    { authorization: `Bearer ${token}` },
  );
  assert.equal(policyRes.res.ok, true);

  const claimRes = await postJson(
    `${BASE_URL}/api/claims`,
    { policyId: policyRes.payload.policy._id, triggerType: 'rainfall', triggerValue: 70 },
    { authorization: `Bearer ${token}` },
  );
  assert.equal(claimRes.res.ok, true);
  const claimId = claimRes.payload.claim._id;

  const approveRes = await fetch(`${BASE_URL}/api/claims/${claimId}/approve`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ approvedAmount: 1200, remarks: 'Approved for payout transfer' }),
  });
  assert.equal(approveRes.ok, true);

  const paidRes = await fetch(`${BASE_URL}/api/claims/${claimId}/paid`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ payoutReference: 'CF_TEST_123', paidAmount: 1200 }),
  });
  assert.equal(paidRes.ok, true);
  const paidPayload = await paidRes.json();
  assert.equal(paidPayload.claim.settlementStatus, 'paid');
  assert.equal(paidPayload.claim.reasonCode, 'PAYOUT_SETTLED');

  const invalidPaidRes = await fetch(`${BASE_URL}/api/claims/${claimId}/paid`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ payoutReference: 'CF_TEST_124' }),
  });
  assert.equal(invalidPaidRes.status, 409);
  const invalidPayload = await invalidPaidRes.json();
  assert.equal(invalidPayload.reasonCode, 'INVALID_TRANSITION');
});
