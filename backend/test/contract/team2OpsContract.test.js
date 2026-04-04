const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../../models/User');

const BASE_URL = process.env.WORKSHIELD_BASE_URL || 'http://localhost';
const MONGO_URI = process.env.WORKSHIELD_MONGO_URI || 'mongodb://localhost:27017/workshield';

const uniqueEmail = () => `team2_contract_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;

const postJson = async (url, body, headers = {}) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const payload = await res.json();
  return { res, payload };
};

test('team2 ops summary endpoint returns stable shape', async () => {
  const email = uniqueEmail();

  const reg = await postJson(`${BASE_URL}/api/auth/register`, {
    name: 'Team2 Contract Admin',
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
  const summaryRes = await fetch(`${BASE_URL}/api/team2/ops/summary`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(summaryRes.ok, true);

  const summaryPayload = await summaryRes.json();
  assert.equal(summaryPayload.success, true);
  assert.equal(typeof summaryPayload.summary.generatedAt, 'string');
  assert.equal(typeof summaryPayload.summary.settlement, 'object');
  assert.equal(typeof summaryPayload.summary.verdict, 'object');
  assert.equal(typeof summaryPayload.summary.payoutAttempts, 'object');
  assert.equal(typeof summaryPayload.summary.manualReviewQueueCount, 'number');

  const schedulerRes = await fetch(`${BASE_URL}/api/team2/ops/scheduler`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(schedulerRes.ok, true);
  const schedulerPayload = await schedulerRes.json();
  assert.equal(schedulerPayload.success, true);
  assert.equal(typeof schedulerPayload.scheduler.enabled, 'boolean');
  assert.equal(typeof schedulerPayload.scheduler.started, 'boolean');
  assert.equal(typeof schedulerPayload.scheduler.intervals.payoutCycleMs, 'number');

  const reconcileRes = await fetch(`${BASE_URL}/api/team2/ops/reconcile`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });
  assert.equal(reconcileRes.ok, true);
  const reconcilePayload = await reconcileRes.json();
  assert.equal(reconcilePayload.success, true);
  assert.equal(typeof reconcilePayload.summary.generatedAt, 'string');
  assert.equal(typeof reconcilePayload.summary.staleProviderSuccess, 'number');
  assert.equal(typeof reconcilePayload.summary.retryOverdue, 'number');
  assert.equal(typeof reconcilePayload.summary.conflictCount, 'number');
});
