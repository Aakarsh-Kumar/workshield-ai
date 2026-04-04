const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorRole: { type: String, default: 'anonymous', index: true },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, default: 'unknown', index: true },
    resourceId: { type: String, default: null },
    method: { type: String, required: true },
    path: { type: String, required: true, index: true },
    statusCode: { type: Number, required: true, index: true },
    success: { type: Boolean, required: true, index: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    requestId: { type: String },
    latencyMs: { type: Number, min: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);

AuditLogSchema.index({ createdAt: -1, action: 1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
