const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.WORKSHIELD_BASE_URL || 'http://localhost';

const uniqueEmail = () => `itest_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;

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

test('integration: create policy -> file claim -> settle fields present', async () => {
  const email = uniqueEmail();

  const reg = await postJson(`${BASE_URL}/api/auth/register`, {
    name: 'Integration User',
    email,
    password: 'Pass@1234',
    platform: 'swiggy',
    weeklyDeliveries: 30,
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
    { type: 'weekly', coverageAmount: 2500 },
    { authorization: `Bearer ${token}` },
  );
  assert.equal(policy.res.ok, true);

  const policyId = policy.payload.policy._id;
  assert.equal(typeof policyId, 'string');

  const claimCreate = await postJson(
    `${BASE_URL}/api/claims`,
    { policyId, triggerType: 'rainfall', triggerValue: 60 },
    { authorization: `Bearer ${token}` },
  );
  assert.equal(claimCreate.res.ok, true);

  const claimId = claimCreate.payload.claim._id;
  assert.equal(typeof claimId, 'string');

  let claim = null;
  for (let i = 0; i < 15; i += 1) {
    const getRes = await fetch(`${BASE_URL}/api/claims/${claimId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(getRes.ok, true);
    const getPayload = await getRes.json();
    claim = getPayload.claim;
    if (claim.settlementStatus && claim.settlementStatus !== 'pending') {
      break;
    }
    await sleep(250);
  }

  assert.ok(claim);
  assert.equal(typeof claim.reasonCode, 'string');
  assert.equal(typeof claim.reasonDetail, 'string');
  assert.equal(typeof claim.payoutEligibility, 'boolean');
  assert.equal(typeof claim.responseContractVersion, 'string');
  assert.equal(typeof claim.evaluationMeta, 'object');
  assert.equal(['pending', 'approved', 'soft_flag', 'hard_block', 'paid'].includes(claim.settlementStatus), true);
});
