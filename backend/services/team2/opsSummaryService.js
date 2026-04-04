const Claim = require('../../models/Claim');
const PayoutAttempt = require('../../models/PayoutAttempt');
const { SETTLEMENT_STATUS } = require('../../constants/decisionContract');

const mapCounts = (rows, keyField, valueField) => {
  return rows.reduce((acc, row) => {
    acc[row[keyField]] = row[valueField];
    return acc;
  }, {});
};

const buildOpsSummary = async () => {
  const [settlementRows, verdictRows, payoutRows, manualQueueCount] = await Promise.all([
    Claim.aggregate([{ $group: { _id: '$settlementStatus', count: { $sum: 1 } } }]),
    Claim.aggregate([{ $group: { _id: '$fraudVerdict', count: { $sum: 1 } } }]),
    PayoutAttempt.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Claim.countDocuments({ settlementStatus: SETTLEMENT_STATUS.SOFT_FLAG }),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    settlement: mapCounts(settlementRows, '_id', 'count'),
    verdict: mapCounts(verdictRows, '_id', 'count'),
    payoutAttempts: mapCounts(payoutRows, '_id', 'count'),
    manualReviewQueueCount: manualQueueCount,
  };
};

module.exports = {
  buildOpsSummary,
};
