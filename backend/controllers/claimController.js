const Claim = require('../models/Claim');
const Policy = require('../models/Policy');
const { checkFraud } = require('../services/fraudService');

/**
 * POST /api/claims
 * File a new claim against an active policy.
 * Body: { policyId, triggerType, triggerValue, documents? }
 *
 * Fraud check is triggered asynchronously so the worker gets an immediate response.
 */
exports.createClaim = async (req, res) => {
  try {
    const { policyId, triggerType, triggerValue, documents } = req.body;

    if (!policyId || !triggerType || triggerValue == null) {
      return res.status(400).json({
        success: false,
        message: 'policyId, triggerType, and triggerValue are required',
      });
    }

    // Confirm the policy belongs to this worker and is active
    const policy = await Policy.findOne({ _id: policyId, userId: req.user.id, status: 'active' });
    if (!policy) {
      return res.status(404).json({ success: false, message: 'Active policy not found' });
    }

    if (new Date() > policy.endDate) {
      return res.status(400).json({ success: false, message: 'Policy has expired' });
    }

    const claim = await Claim.create({
      policyId,
      userId: req.user.id,
      triggerType,
      triggerValue: Number(triggerValue),
      documents: documents || [],
      status: 'pending',
    });

    // Kick off async fraud assessment — does not block the HTTP response
    checkFraud(claim._id.toString()).catch((e) =>
      console.error(`Async fraud check failed for claim ${claim._id}:`, e.message),
    );

    res.status(201).json({ success: true, claim });
  } catch (err) {
    console.error('createClaim error:', err);
    res.status(500).json({ success: false, message: 'Failed to file claim' });
  }
};

/**
 * GET /api/claims
 * List all claims for the authenticated worker.
 */
exports.getClaims = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { userId: req.user.id };
    if (status) filter.status = status;

    const claims = await Claim.find(filter)
      .populate('policyId', 'policyNumber type coverageAmount platform')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, claims });
  } catch (err) {
    console.error('getClaims error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch claims' });
  }
};

/**
 * GET /api/claims/:id
 */
exports.getClaim = async (req, res) => {
  try {
    const claim = await Claim.findOne({ _id: req.params.id, userId: req.user.id })
      .populate('policyId', 'policyNumber type coverageAmount triggers platform')
      .lean();

    if (!claim) {
      return res.status(404).json({ success: false, message: 'Claim not found' });
    }
    res.json({ success: true, claim });
  } catch (err) {
    console.error('getClaim error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch claim' });
  }
};

/**
 * PATCH /api/claims/:id/approve  [admin only]
 * Approve a claim and set the approved payout amount.
 * Body: { approvedAmount, remarks? }
 */
exports.approveClaim = async (req, res) => {
  try {
    const { approvedAmount, remarks } = req.body;

    if (approvedAmount == null || approvedAmount < 0) {
      return res.status(400).json({ success: false, message: 'A valid approvedAmount is required' });
    }

    const claim = await Claim.findByIdAndUpdate(
      req.params.id,
      {
        approvedAmount: Number(approvedAmount),
        remarks,
        status: 'approved',
        processedAt: new Date(),
      },
      { new: true },
    );

    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    res.json({ success: true, claim });
  } catch (err) {
    console.error('approveClaim error:', err);
    res.status(500).json({ success: false, message: 'Failed to approve claim' });
  }
};

/**
 * PATCH /api/claims/:id/reject  [admin only]
 * Reject a claim with a reason.
 */
exports.rejectClaim = async (req, res) => {
  try {
    const { remarks } = req.body;
    const claim = await Claim.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', remarks, processedAt: new Date() },
      { new: true },
    );
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    res.json({ success: true, claim });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reject claim' });
  }
};
