const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const User = require('../../models/User');
const PayoutAttempt = require('../../models/PayoutAttempt');

const BASE_URL = process.env.WORKSHIELD_BASE_URL || 'http://localhost';
const MONGO_URI = process.env.WORKSHIELD_MONGO_URI || 'mongodb://localhost:27017/workshield';

const uniqueEmail = () => `team2_payout_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const postJson = async (url, body, headers = {}) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const payload = await res.json();
  return { res, payload };
};

test('integration: team2 payout cycle marks approved claim as paid', async () => {
  const email = uniqueEmail();

  const reg = await postJson(`${BASE_URL}/api/auth/register`, {
    name: 'Team2 Admin',
    email,
    password: 'Pass@1234',
    platform: 'swiggy',
    weeklyDeliveries: 30,
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
    { type: 'weekly', coverageAmount: 3000 },
    { authorization: `Bearer ${token}` },
  );
  assert.equal(policyRes.res.ok, true);

  const claimRes = await postJson(
    `${BASE_URL}/api/claims`,
    { policyId: policyRes.payload.policy._id, triggerType: 'rainfall', triggerValue: 72 },
    { authorization: `Bearer ${token}` },
  );
  assert.equal(claimRes.res.ok, true);
  const claimId = claimRes.payload.claim._id;

  // Wait for async fraud evaluation to settle so manual approval is deterministic.
  for (let i = 0; i < 20; i += 1) {
    const checkRes = await fetch(`${BASE_URL}/api/claims/${claimId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(checkRes.ok, true);
    const checkPayload = await checkRes.json();
    if (checkPayload.claim.settlementStatus !== 'pending') {
      break;
    }
    await sleep(200);
  }

  const approveRes = await fetch(`${BASE_URL}/api/claims/${claimId}/approve`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ approvedAmount: 1500, remarks: 'Approved for Team 2 payout cycle' }),
  });
  assert.equal(approveRes.ok, true);

  const runRes = await fetch(`${BASE_URL}/api/team2/payouts/run`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ limit: 100 }),
  });
  assert.equal(runRes.ok, true);
  const runPayload = await runRes.json();
  assert.equal(runPayload.success, true);

  let claimPayload = null;
  for (let i = 0; i < 20; i += 1) {
    const claimGet = await fetch(`${BASE_URL}/api/claims/${claimId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(claimGet.ok, true);
    claimPayload = await claimGet.json();
    if (claimPayload.claim.settlementStatus === 'paid') {
      break;
    }
    await sleep(150);
  }

  assert.ok(claimPayload);
  assert.equal(claimPayload.claim.settlementStatus, 'paid');
  assert.equal(claimPayload.claim.reasonCode, 'PAYOUT_SETTLED');

  await mongoose.connect(MONGO_URI);
  const attempt = await PayoutAttempt.findOne({ claimId });
  assert.ok(attempt);
  assert.equal(attempt.status, 'callback_confirmed');
  await mongoose.disconnect();
});
