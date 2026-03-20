const jwt = require('jsonwebtoken');
const User = require('../models/User');

/** Sign JWT for a given userId */
const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

/** Strip sensitive fields before sending user to client */
const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  platform: user.platform,
  weeklyDeliveries: user.weeklyDeliveries,
  riskScore: user.riskScore,
  kycVerified: user.kycVerified,
  role: user.role,
});

/**
 * POST /api/auth/register
 * Body: { name, email, password, phone, platform, weeklyDeliveries }
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, platform, weeklyDeliveries } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, email, and password are required' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Email is already registered' });
    }

    const user = await User.create({ name, email, password, phone, platform, weeklyDeliveries });
    const token = signToken(user._id);

    res.status(201).json({ success: true, token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
};

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Select password explicitly (it has select: false in schema)
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = signToken(user._id);
    res.json({ success: true, token, user: sanitizeUser(user) });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

/**
 * GET /api/auth/me  [protected]
 * Returns the currently authenticated user.
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    console.error('getMe error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
};

/**
 * PATCH /api/auth/profile  [protected]
 * Update mutable profile fields.
 */
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, platform, weeklyDeliveries } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, platform, weeklyDeliveries },
      { new: true, runValidators: true },
    );
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    console.error('updateProfile error:', err);
    res.status(500).json({ success: false, message: 'Profile update failed' });
  }
};
