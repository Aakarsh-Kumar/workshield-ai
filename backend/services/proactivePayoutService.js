const HazardZone = require('../models/HazardZone');
const Policy = require('../models/Policy');
const { findWorkersInZone } = require('./zoneValidatorService');
const { processTriggerEvent } = require('./triggerService');

const processHazardEvent = async ({
  zoneId,
  triggerType,
  triggerValue,
  timeWindow,
  eventMeta = {},
}) => {
  const zone = await HazardZone.findOne({ zoneId, isActive: true }).lean();
  if (!zone) {
    throw new Error(`HazardZone '${zoneId}' not found or inactive`);
  }

  const workerIds = await findWorkersInZone(zone.boundary, timeWindow);

  if (workerIds.length === 0) {
    return {
      zoneId,
      triggerType,
      triggerValue,
      workersFound: 0,
      workersWithPolicies: 0,
      claimsCreated: 0,
      claimsSkipped: 0,
      errors: 0,
      details: [],
    };
  }

  const now = new Date();
  const policies = await Policy.find({
    userId: { $in: workerIds },
    status: 'active',
    endDate: { $gt: now },
    'triggers.type': triggerType,
  })
    .select('_id userId')
    .lean();

  const workersWithPolicies = new Set(policies.map((policy) => String(policy.userId)));
  const details = [];
  let claimsCreated = 0;
  let claimsSkipped = 0;
  let errors = 0;

  const BATCH_SIZE = 10;
  for (let i = 0; i < policies.length; i += BATCH_SIZE) {
    const batch = policies.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (policy) => {
        const result = await processTriggerEvent(
          policy._id.toString(),
          triggerType,
          Number(triggerValue),
          eventMeta,
        );

        return {
          policyId: policy._id.toString(),
          workerId: String(policy.userId),
          result,
        };
      }),
    );

    batchResults.forEach((settled) => {
      if (settled.status === 'fulfilled') {
        const { policyId, workerId, result } = settled.value;
        if (result.triggered) {
          claimsCreated += 1;
          details.push({
            workerId,
            policyId,
            claimId: result.claim?._id?.toString() ?? null,
            status: 'claim_created',
            claimAmount: result.claimAmount,
            settlementStatus: result.settlementStatus,
          });
        } else {
          claimsSkipped += 1;
          details.push({
            workerId,
            policyId,
            claimId: null,
            status: 'skipped',
            reason: result.reasonCode,
          });
        }
      } else {
        errors += 1;
        details.push({
          workerId: null,
          policyId: null,
          claimId: null,
          status: 'error',
          reason: settled.reason?.message ?? 'unknown',
        });
      }
    });
  }

  return {
    zoneId,
    triggerType,
    triggerValue: Number(triggerValue),
    workersFound: workerIds.length,
    workersWithPolicies: workersWithPolicies.size,
    claimsCreated,
    claimsSkipped,
    errors,
    details,
  };
};

module.exports = {
  processHazardEvent,
};
