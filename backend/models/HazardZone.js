const mongoose = require('mongoose');

const HazardZoneSchema = new mongoose.Schema(
  {
    zoneId: { type: String, unique: true, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    city: { type: String, trim: true },
    notes: { type: String, trim: true },
    hazardType: {
      type: String,
      enum: ['FLOOD', 'CYCLONE', 'HEATWAVE', 'LANDSLIDE'],
      required: true,
    },
    boundary: {
      type: {
        type: String,
        enum: ['Polygon', 'MultiPolygon'],
        required: true,
      },
      coordinates: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
      },
    },
    riskMultiplier: { type: Number, default: 1.0, min: 0.1, max: 5.0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

HazardZoneSchema.index({ boundary: '2dsphere' });
HazardZoneSchema.index({ hazardType: 1, isActive: 1 });

module.exports = mongoose.model('HazardZone', HazardZoneSchema);
