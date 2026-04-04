const mongoose = require('mongoose');
const { PAYOUT_ATTEMPT_STATUS } = require('../constants/team2Payout');

const PayoutAttemptSchema = new mongoose.Schema(
  {
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Claim',
      required: true,
      unique: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(PAYOUT_ATTEMPT_STATUS),
      default: PAYOUT_ATTEMPT_STATUS.QUEUED,
      index: true,
    },
    attemptCount: { type: Number, default: 0 },
    firstAttemptAt: { type: Date },
    lastAttemptAt: { type: Date },
    nextRetryAt: { type: Date, index: true },
    providerReference: { type: String, index: true },
    providerMode: { type: String, default: 'mock' },
    lastError: { type: mongoose.Schema.Types.Mixed },
    providerPayload: { type: mongoose.Schema.Types.Mixed },
    timeline: [
      {
        at: { type: Date, default: Date.now },
        event: { type: String, required: true },
        detail: { type: mongoose.Schema.Types.Mixed },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model('PayoutAttempt', PayoutAttemptSchema);
