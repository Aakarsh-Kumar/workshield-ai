const mongoose = require('mongoose');

/**
 * Claim — filed against an active Policy when a trigger event occurs.
 *
 * In parametric insurance, claims are straightforward:
 *  - Worker reports a trigger event with observed value
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
      enum: ['rainfall', 'vehicle_accident', 'platform_outage', 'hospitalization'],
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

    // Supporting documents (S3 keys or local paths)
    documents: [{ type: String }],

    remarks: { type: String },
    processedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model('Claim', ClaimSchema);
