const mongoose = require('mongoose');

const ManualReviewActionSchema = new mongoose.Schema(
  {
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Claim',
      required: true,
      index: true,
    },
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: ['approve', 'reject'],
      required: true,
    },
    reason: { type: String },
    approvedAmount: { type: Number },
    snapshot: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

module.exports = mongoose.model('ManualReviewAction', ManualReviewActionSchema);
