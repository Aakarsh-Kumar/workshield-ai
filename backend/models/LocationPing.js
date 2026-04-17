const mongoose = require('mongoose');

const LocationPingSchema = new mongoose.Schema(
  {
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    timestamp: { type: Date, required: true, index: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator(value) {
            return Array.isArray(value) && value.length === 2;
          },
          message: 'location.coordinates must contain [lng, lat]',
        },
      },
    },
    accuracy: { type: Number, required: true, min: 0 },
    speed: { type: Number, default: 0, min: 0 },
    isOfflineSync: { type: Boolean, default: false },
    telemetry: {
      sessionId: { type: String, index: true },
      deviceId: { type: String, index: true },
      userAgent: { type: String },
      platform: { type: String },
      language: { type: String },
      timezone: { type: String },
      timezoneOffsetMinutes: { type: Number },
      online: { type: Boolean },
      visibilityState: { type: String },
      hardwareConcurrency: { type: Number },
      deviceMemoryGb: { type: Number },
      maxTouchPoints: { type: Number },
    },
  },
  { timestamps: true },
);

LocationPingSchema.index({ location: '2dsphere' });
LocationPingSchema.index({ workerId: 1, timestamp: -1 });
LocationPingSchema.index({ workerId: 1, 'telemetry.sessionId': 1, timestamp: -1 });
LocationPingSchema.index({ workerId: 1, 'telemetry.deviceId': 1, timestamp: -1 });

module.exports = mongoose.model('LocationPing', LocationPingSchema);
