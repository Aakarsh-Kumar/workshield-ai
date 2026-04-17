const mongoose = require('mongoose');
const { SETTLEMENT_STATUS } = require('../constants/decisionContract');

/**
 * Claim — filed against an active Policy when a trigger event occurs.
 *
 * In parametric insurance, claims are straightforward:
 *  - Worker reports a trigger event with context
 *  - AI fraud service scores the claim
 *  - If clean and trigger met, payout is auto-approved
 */
const ClaimSchema = new mongoose.Schema(
  {
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Reported parametric trigger
    triggerType: {
      type: String,
      enum: ['rainfall', 'vehicle_accident', 'platform_outage', 'hospitalization', 'traffic_congestion'],
      required: true,
    },
    triggerValue: { type: Number }, // mm of rain, hours of outage, etc.

    // Financial (INR)
    claimAmount: { type: Number },
    approvedAmount: { type: Number },

    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected', 'paid'],
      default: 'pending',
      index: true,
    },

    // AI fraud assessment output
    fraudScore: { type: Number, default: 0, min: 0, max: 1 },
    isFraudulent: { type: Boolean, default: false },
    fraudVerdict: {
      type: String,
      enum: ['auto_approve', 'soft_flag', 'hard_block'],
      default: 'auto_approve',
    },
    fraudSignals: [{ type: String }],
    fraudModelVersion: { type: String },

    reasonCode: { type: String },
    reasonDetail: { type: String },
    settlementStatus: {
      type: String,
      enum: Object.values(SETTLEMENT_STATUS),
      default: SETTLEMENT_STATUS.PENDING,
      index: true,
    },
    payoutEligibility: { type: Boolean, default: false },
    evaluationMeta: { type: mongoose.Schema.Types.Mixed },
    responseContractVersion: { type: String, default: 'v1' },

    documents: [
      {
        content_base64: { type: String },
        mime_type: { type: String },
        file_name: { type: String },
      },
    ],

    remarks: { type: String },
    processedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Claim', ClaimSchema);
