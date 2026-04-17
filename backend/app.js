require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./utils/db');

const authRoutes = require('./routes/authRoutes');
const policyRoutes = require('./routes/policyRoutes');
const claimRoutes = require('./routes/claimRoutes');
const team2Routes = require('./routes/team2Routes');
const chatRoutes = require('./routes/chatRoutes');
const locationRoutes = require('./routes/locationRoutes');
const { startTeam2Schedulers } = require('./services/team2/schedulerService');
const { apiLimiter } = require('./middleware/rateLimiters');
const { auditMutationRequests } = require('./middleware/auditTrail');

const app = express();
app.set('trust proxy', 1);

// ── Database ──────────────────────────────────────────────────────────────────

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiLimiter);
app.use(auditMutationRequests);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) =>
  res.json({ status: 'ok', service: 'workshield-backend', timestamp: new Date().toISOString() }),
);

// ── Routes ────────────────────────────────────────────────────────────────────
// All routes are prefixed with /api to match NGINX location block
app.use('/api/auth', authRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/team2', team2Routes);
app.use('/api/chat', chatRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global Error Handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 WorkShield backend running on port ${PORT}`);
    startTeam2Schedulers();
  });
};

startServer();

module.exports = app;
