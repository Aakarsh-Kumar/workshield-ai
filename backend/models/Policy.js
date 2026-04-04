const mongoose = require('mongoose');
const {
  POLICY_EXCLUSION_CODES,
  DEFAULT_POLICY_EXCLUSIONS,
  DEFAULT_UNDERWRITING_GUIDELINES,
} = require('../constants/policyCompliance');

/**
 * Policy — parametric insurance policy for a gig worker.
 *
 * Parametric insurance pays out automatically when a pre-defined trigger
 * condition is met (e.g., >50mm rainfall, >4hr platform outage), without
 * requiring a traditional loss assessment.
 */
const PolicySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Auto-generated unique policy reference
    policyNumber: { type: String, unique: true },

    type: { type: String, enum: ['weekly', 'daily'], default: 'weekly' },

    // Financial terms (INR)
    coverageAmount: { type: Number, required: true, min: 100 },
    premium: { type: Number, required: true, min: 0 },

    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'claimed'],
      default: 'active',
      index: true,
    },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    /**
     * Parametric trigger definitions.
     * trigger.type       — event category
     * trigger.threshold  — minimum observed value to activate payout
     * trigger.payoutRatio — fraction of coverageAmount to pay (0–1)
     */
    triggers: [
      {
        type: {
          type: String,
          enum: ['rainfall', 'vehicle_accident', 'platform_outage', 'hospitalization'],
        },
        threshold: { type: Number },
        payoutRatio: { type: Number, min: 0, max: 1 },
      },
    ],

    exclusions: {
      type: [String],
      enum: POLICY_EXCLUSION_CODES,
      default: DEFAULT_POLICY_EXCLUSIONS,
    },
    termsVersion: { type: String, default: '1.0' },
    regulatoryReference: {
      type: String,
      default: 'IRDAI_REFERENCE_PENDING',
    },
    underwritingGuidelines: {
      minCoverageAmount: {
        type: Number,
        default: DEFAULT_UNDERWRITING_GUIDELINES.minCoverageAmount,
      },
      maxCoverageAmount: {
        type: Number,
        default: DEFAULT_UNDERWRITING_GUIDELINES.maxCoverageAmount,
      },
      maxClaimsPerPolicy: {
        type: Number,
        default: DEFAULT_UNDERWRITING_GUIDELINES.maxClaimsPerPolicy,
      },
    },

    // Snapshot of AI-scored risk at policy issuance
    aiRiskScore: { type: Number, default: 0, min: 0, max: 1 },
    weeklyDeliveriesAtIssuance: { type: Number },
    platform: { type: String },
  },
  { timestamps: true },
);

// Auto-generate policy number on first save
PolicySchema.pre('save', function (next) {
  if (!this.policyNumber) {
    this.policyNumber = `WSP-${Date.now()}-${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Policy', PolicySchema);
