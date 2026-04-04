const PayoutAttempt = require('../models/PayoutAttempt');
const { runPayoutCycle } = require('../services/team2/payoutOrchestratorService');
const { listManualReviewQueue, applyManualReviewDecision } = require('../services/team2/manualReviewService');
const { buildOpsSummary } = require('../services/team2/opsSummaryService');
const { runDailyReconciliation } = require('../services/team2/reconciliationService');
const { getSchedulerStatus } = require('../services/team2/schedulerService');
const AuditLog = require('../models/AuditLog');

exports.runPayoutCycle = async (req, res) => {
  try {
    const { limit } = req.body || {};
    const result = await runPayoutCycle({ limit });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('runPayoutCycle error:', err);
    return res.status(500).json({ success: false, message: 'Failed to run payout cycle' });
  }
};

exports.getOpsSummary = async (_req, res) => {
  try {
    const summary = await buildOpsSummary();
    return res.json({ success: true, summary });
  } catch (err) {
    console.error('getOpsSummary error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch Team 2 ops summary' });
  }
};

exports.getManualReviewQueue = async (req, res) => {
  try {
    const queue = await listManualReviewQueue({ limit: req.query.limit });
    return res.json({ success: true, queue });
  } catch (err) {
    console.error('getManualReviewQueue error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch manual review queue' });
  }
};

exports.applyManualReviewDecision = async (req, res) => {
  try {
    const result = await applyManualReviewDecision({
      claimId: req.params.id,
      action: req.body?.action,
      actorUserId: req.user.id,
      approvedAmount: req.body?.approvedAmount,
      remarks: req.body?.remarks,
    });

    if (!result.ok) {
      if (result.error) {
        return res.status(result.status).json({ success: false, ...result.error });
      }
      return res.status(result.status).json({ success: false, message: result.message });
    }

    return res.json({ success: true, claim: result.claim });
  } catch (err) {
    console.error('applyManualReviewDecision error:', err);
    return res.status(500).json({ success: false, message: 'Failed to apply manual review decision' });
  }
};

exports.getPayoutAttempts = async (req, res) => {
  try {
    const { status, limit } = req.query;
    const query = status ? { status } : {};
    const rows = await PayoutAttempt.find(query)
      .populate('claimId', 'claimAmount approvedAmount settlementStatus payoutEligibility reasonCode reasonDetail')
      .sort({ updatedAt: -1 })
      .limit(Math.max(1, Math.min(Number(limit) || 50, 200)))
      .lean();

    return res.json({ success: true, attempts: rows });
  } catch (err) {
    console.error('getPayoutAttempts error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch payout attempts' });
  }
};

exports.runReconciliation = async (_req, res) => {
  try {
    const summary = await runDailyReconciliation({ emitAlert: true });
    return res.json({ success: true, summary });
  } catch (err) {
    console.error('runReconciliation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to run reconciliation' });
  }
};

exports.getSchedulerStatus = async (_req, res) => {
  try {
    return res.json({ success: true, scheduler: getSchedulerStatus() });
  } catch (err) {
    console.error('getSchedulerStatus error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch scheduler status' });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const { limit, action, actorRole, pathContains } = req.query;

    const query = {};
    if (action) query.action = action;
    if (actorRole) query.actorRole = actorRole;
    if (pathContains) query.path = { $regex: pathContains, $options: 'i' };

    const rows = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.max(1, Math.min(Number(limit) || 50, 200)))
      .lean();

    return res.json({ success: true, logs: rows });
  } catch (err) {
    console.error('getAuditLogs error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch audit logs' });
  }
};
