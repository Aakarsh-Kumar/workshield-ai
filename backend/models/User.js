const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User — gig economy delivery worker profile.
 * Stores platform affiliation, delivery stats, KYC status, and AI risk score.
 */
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    password: { type: String, select: false }, // excluded from queries by default
    googleId: { type: String },

    // Gig platform info — used for premium calculation
    platform: {
      type: String,
      enum: ['swiggy', 'zomato', 'blinkit', 'dunzo', 'other'],
      default: 'other',
    },
    weeklyDeliveries: { type: Number, default: 0, min: 0 },

    // AI-assigned risk score (0–1); updated periodically by AI service
    riskScore: { type: Number, default: 0.5, min: 0, max: 1 },

    // Policy score (0–1000); calculated from claim approval history, like credit score
    policyScore: { type: Number, default: 700, min: 0, max: 1000 },

    isActive: { type: Boolean, default: true },
    kycVerified: { type: Boolean, default: false },
    role: { type: String, enum: ['worker', 'admin'], default: 'worker' },
  },
  { timestamps: true },
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', UserSchema);
