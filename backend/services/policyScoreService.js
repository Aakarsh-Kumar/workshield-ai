/**
 * Policy Score Service
 * Calculates a credit-score-like policy score (0-1000) based on claim history
 * - Approved claims increase score
 * - Rejected/disputed claims decrease score  
 * - Fraud flags heavily penalize score
 * - Recent claims weighted more heavily
 */

const Claim = require('../models/Claim');
const User = require('../models/User');

/**
 * Calculate policy score for a user based on their claim history.
 * Returns a score 0-1000 (like credit score: 300 poor, 700 good, 850+ excellent).
 */
async function calculatePolicyScore(userId) {
  try {
    // Fetch all claims for the user
    const claims = await Claim.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    if (claims.length === 0) {
      // New user with no claim history gets baseline score
      return 700;
    }

    // Score calculation breakdown:
    // Base: 700 (neutral/good starting point)
    // Per approved claim: +15 points (max 250)
    // Per rejected claim: -25 points (min -250)
    // Per fraud soft_flag: -50 points
    // Per fraud hard_block: -100 points
    // Recent claims (last 30 days) weighted 1.5x
    // Claim streak bonus: +50 if last 3 approved

    let score = 700;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let approvedCount = 0;
    let rejectedCount = 0;
    let fraudSoftCount = 0;
    let fraudHardCount = 0;
    let recentApprovedStreak = 0;

    // Analyze claim history
    for (let i = 0; i < claims.length; i++) {
      const claim = claims[i];
      const claimDate = new Date(claim.createdAt);
      const isRecent = claimDate > thirtyDaysAgo;

      // Status-based scoring
      const settlementStatus = claim.settlementStatus || claim.status;
      if (
        settlementStatus === 'paid'
        || settlementStatus === 'approved'
        || settlementStatus === 'provider_success'
      ) {
        const increment = 15 * (isRecent ? 1.5 : 1);
        approvedCount += 1;
        score += increment;

        // Streak bonus: if this is in top 3 and approved, increment streak
        if (i < 3) recentApprovedStreak += 1;
      } else if (
        settlementStatus === 'rejected'
        || settlementStatus === 'hard_block'
        || settlementStatus === 'failed_terminal'
      ) {
        const decrement = 25 * (isRecent ? 1.5 : 1);
        rejectedCount += 1;
        score -= decrement;
        recentApprovedStreak = 0; // Reset streak on rejection
      }

      // Fraud-based scoring
      const fraudVerdict = claim.fraudVerdict || 'auto_approve';
      if (fraudVerdict === 'soft_flag') {
        fraudSoftCount += 1;
        score -= 50 * (isRecent ? 1.5 : 1);
      } else if (fraudVerdict === 'hard_block') {
        fraudHardCount += 1;
        score -= 100 * (isRecent ? 1.5 : 1);
      }
    }

    // Streak bonus: if last 3 claims all approved
    if (recentApprovedStreak === 3) {
      score += 50;
    }

    // Cap score between 0 and 1000
    score = Math.max(0, Math.min(1000, score));

    return Math.round(score);
  } catch (err) {
    console.error('Error calculating policy score:', err);
    // Return baseline on error
    return 700;
  }
}

/**
 * Update policy score for a user and save to database.
 */
async function updateUserPolicyScore(userId) {
  try {
    const newScore = await calculatePolicyScore(userId);
    await User.updateOne({ _id: userId }, { policyScore: newScore });
    return newScore;
  } catch (err) {
    console.error('Error updating policy score:', err);
    return null;
  }
}

/**
 * Get policy score band/tier label for UI display.
 * Similar to credit score ranges.
 */
function getPolicyScoreTier(score) {
  if (score >= 850) return { tier: 'Excellent', label: 'Excellent', color: 'emerald' };
  if (score >= 750) return { tier: 'Good', label: 'Good', color: 'sky' };
  if (score >= 650) return { tier: 'Fair', label: 'Fair', color: 'amber' };
  if (score >= 550) return { tier: 'Poor', label: 'Poor', color: 'orange' };
  return { tier: 'Very Poor', label: 'Very Poor', color: 'rose' };
}

module.exports = {
  calculatePolicyScore,
  updateUserPolicyScore,
  getPolicyScoreTier,
};
