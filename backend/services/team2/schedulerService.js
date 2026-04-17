const { runPayoutCycle } = require('./payoutOrchestratorService');
const { buildOpsSummary } = require('./opsSummaryService');
const { runDailyReconciliation } = require('./reconciliationService');
const { sendOpsAlert } = require('./alertService');
const { runClaimFraudBackfill } = require('./claimFraudBackfillService');

const SCHEDULER_ENABLED = String(process.env.TEAM2_SCHEDULER_ENABLED || 'true').toLowerCase() !== 'false';
const PAYOUT_INTERVAL_MS = Number(process.env.TEAM2_PAYOUT_CYCLE_INTERVAL_MS || 2 * 60 * 1000);
const PAYOUT_BATCH_LIMIT = Number(process.env.TEAM2_PAYOUT_BATCH_LIMIT || 50);
const HEALTH_INTERVAL_MS = Number(process.env.TEAM2_HEALTH_CHECK_INTERVAL_MS || 60 * 60 * 1000);
const RECON_INTERVAL_MS = Number(process.env.TEAM2_RECONCILIATION_INTERVAL_MS || 24 * 60 * 60 * 1000);
const MANUAL_QUEUE_ALERT_THRESHOLD = Number(process.env.TEAM2_ALERT_MANUAL_QUEUE_THRESHOLD || 25);
const STALE_PENDING_RESCORING_ENABLED = String(process.env.TEAM2_STALE_PENDING_RESCORING_ENABLED || 'true').toLowerCase() !== 'false';
const STALE_PENDING_RESCORING_INTERVAL_MS = Number(process.env.TEAM2_STALE_PENDING_RESCORING_INTERVAL_MS || 30 * 60 * 1000);
const STALE_PENDING_RESCORING_BATCH_LIMIT = Number(process.env.TEAM2_STALE_PENDING_RESCORING_BATCH_LIMIT || 25);
const STALE_PENDING_RESCORING_AGE_HOURS = Number(process.env.TEAM2_STALE_PENDING_RESCORING_AGE_HOURS || 6);

let started = false;
let startedAt = null;
const handles = [];

const safeTick = async (name, fn) => {
  try {
    await fn();
  } catch (err) {
    console.error(`team2 scheduler tick failed (${name}):`, err.message);
    await sendOpsAlert({
      key: `scheduler_tick_${name}`,
      severity: 'error',
      message: `Scheduler tick failed: ${name}`,
      payload: { error: err.message },
    });
  }
};

const runHealthCheck = async () => {
  const summary = await buildOpsSummary();
  const failedTerminal = Number(summary.payoutAttempts.failed_terminal || 0);
  const conflict = Number(summary.payoutAttempts.conflict || 0);
  const manualQueue = Number(summary.manualReviewQueueCount || 0);

  if (failedTerminal > 0 || conflict > 0 || manualQueue > MANUAL_QUEUE_ALERT_THRESHOLD) {
    await sendOpsAlert({
      key: 'hourly_health_attention',
      severity: 'warning',
      message: 'Team2 hourly health check crossed alert threshold',
      payload: {
        failedTerminal,
        conflict,
        manualQueue,
      },
    });
  }

  return summary;
};

const runStalePendingRescoring = async () => {
  if (!STALE_PENDING_RESCORING_ENABLED) {
    return { skipped: true };
  }

  return runClaimFraudBackfill({
    limit: STALE_PENDING_RESCORING_BATCH_LIMIT,
    settlementStatuses: ['pending'],
    unscoredOnly: false,
    olderThanHours: STALE_PENDING_RESCORING_AGE_HOURS,
  });
};

const startTeam2Schedulers = () => {
  if (!SCHEDULER_ENABLED || started) {
    return;
  }

  started = true;
  startedAt = new Date();

  safeTick('payout_cycle_initial', () => runPayoutCycle({ limit: PAYOUT_BATCH_LIMIT }));
  safeTick('stale_pending_rescoring_initial', runStalePendingRescoring);
  safeTick('health_check_initial', runHealthCheck);
  safeTick('reconciliation_initial', () => runDailyReconciliation({ emitAlert: true }));

  handles.push(setInterval(() => {
    safeTick('payout_cycle', () => runPayoutCycle({ limit: PAYOUT_BATCH_LIMIT }));
  }, PAYOUT_INTERVAL_MS));

  handles.push(setInterval(() => {
    safeTick('stale_pending_rescoring', runStalePendingRescoring);
  }, STALE_PENDING_RESCORING_INTERVAL_MS));

  handles.push(setInterval(() => {
    safeTick('health_check', runHealthCheck);
  }, HEALTH_INTERVAL_MS));

  handles.push(setInterval(() => {
    safeTick('daily_reconciliation', () => runDailyReconciliation({ emitAlert: true }));
  }, RECON_INTERVAL_MS));

  console.log('Team2 scheduler started', {
    PAYOUT_INTERVAL_MS,
    STALE_PENDING_RESCORING_INTERVAL_MS,
    HEALTH_INTERVAL_MS,
    RECON_INTERVAL_MS,
  });
};

const stopTeam2Schedulers = () => {
  while (handles.length > 0) {
    const handle = handles.pop();
    clearInterval(handle);
  }
  started = false;
};

const getSchedulerStatus = () => ({
  enabled: SCHEDULER_ENABLED,
  started,
  startedAt: startedAt ? startedAt.toISOString() : null,
  intervals: {
    payoutCycleMs: PAYOUT_INTERVAL_MS,
    stalePendingRescoringMs: STALE_PENDING_RESCORING_INTERVAL_MS,
    healthCheckMs: HEALTH_INTERVAL_MS,
    reconciliationMs: RECON_INTERVAL_MS,
    batchLimit: PAYOUT_BATCH_LIMIT,
    stalePendingBatchLimit: STALE_PENDING_RESCORING_BATCH_LIMIT,
    stalePendingAgeHours: STALE_PENDING_RESCORING_AGE_HOURS,
  },
});

module.exports = {
  startTeam2Schedulers,
  stopTeam2Schedulers,
  getSchedulerStatus,
  runHealthCheck,
};
