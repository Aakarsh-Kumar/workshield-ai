const { PROVIDER_MODES } = require('../../constants/team2Payout');

const getProviderMode = () => {
  const mode = String(process.env.TEAM2_PROVIDER_MODE || PROVIDER_MODES.MOCK).toLowerCase();
  return mode === PROVIDER_MODES.SANDBOX ? PROVIDER_MODES.SANDBOX : PROVIDER_MODES.MOCK;
};

const buildIdempotencyKey = (claimId) => `payout:${claimId}`;

const executeMockTransfer = async ({ claimId, amount, attemptCount }) => {
  const failureMode = String(process.env.TEAM2_MOCK_FAILURE_MODE || 'none').toLowerCase();

  if (failureMode === 'timeout') {
    return {
      ok: false,
      transient: true,
      statusCode: 504,
      errorCode: 'PROVIDER_TIMEOUT',
      message: 'Mock provider timeout',
    };
  }

  if (failureMode === 'rate_limit') {
    return {
      ok: false,
      transient: true,
      statusCode: 429,
      errorCode: 'PROVIDER_RATE_LIMIT',
      message: 'Mock provider rate limited request',
    };
  }

  if (failureMode === 'decline') {
    return {
      ok: false,
      transient: false,
      statusCode: 422,
      errorCode: 'PROVIDER_DECLINED',
      message: 'Mock provider declined payout request',
    };
  }

  return {
    ok: true,
    transient: false,
    statusCode: 200,
    providerReference: `MOCK_${claimId}_${attemptCount}`,
    payload: {
      mode: PROVIDER_MODES.MOCK,
      amount,
      settled: true,
    },
  };
};

const executeSandboxShadow = async ({ claimId, amount, attemptCount }) => {
  return {
    ok: true,
    transient: false,
    statusCode: 200,
    providerReference: `SANDBOX_SHADOW_${claimId}_${attemptCount}`,
    payload: {
      mode: PROVIDER_MODES.SANDBOX,
      shadow: true,
      amount,
      note: 'Sandbox shadow mode simulated until provider credentials are configured.',
    },
  };
};

const executeTransfer = async ({ claimId, amount, attemptCount }) => {
  const mode = getProviderMode();
  if (mode === PROVIDER_MODES.SANDBOX) {
    const result = await executeSandboxShadow({ claimId, amount, attemptCount });
    return { ...result, mode };
  }

  const result = await executeMockTransfer({ claimId, amount, attemptCount });
  return { ...result, mode };
};

module.exports = {
  getProviderMode,
  buildIdempotencyKey,
  executeTransfer,
};
