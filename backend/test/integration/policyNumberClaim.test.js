const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.WORKSHIELD_BASE_URL || 'http://localhost';

const uniqueEmail = () => `pnum_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;

const postJson = async (url, body, headers = {}) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

  const payload = await res.json();
  return { res, payload };
};

test('integration: claim creation accepts policyNumber reference', async () => {
  const email = uniqueEmail();

  const reg = await postJson(`${BASE_URL}/api/auth/register`, {
    name: 'PolicyNumber User',
    email,
    password: 'Pass@1234',
    platform: 'swiggy',
    weeklyDeliveries: 26,
  });
  assert.equal(reg.res.ok, true);

  const login = await postJson(`${BASE_URL}/api/auth/login`, {
    email,
    password: 'Pass@1234',
  });
  assert.equal(login.res.ok, true);

  const token = login.payload.token;
  assert.equal(typeof token, 'string');

  const policy = await postJson(
    `${BASE_URL}/api/policies`,
    { type: 'weekly', coverageAmount: 1800 },
    { authorization: `Bearer ${token}` },
  );
  assert.equal(policy.res.ok, true);

  const policyNumber = policy.payload.policy.policyNumber;
  assert.equal(typeof policyNumber, 'string');

  const claimCreate = await postJson(
    `${BASE_URL}/api/claims`,
    { policyId: policyNumber, triggerType: 'rainfall', triggerValue: 72 },
    { authorization: `Bearer ${token}` },
  );

  assert.equal(claimCreate.res.ok, true);
  assert.equal(claimCreate.payload.success, true);
  assert.equal(typeof claimCreate.payload.claim._id, 'string');
});
