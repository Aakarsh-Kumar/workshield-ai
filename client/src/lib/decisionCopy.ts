type DecisionMeta = {
  title: string;
  summary: string;
  workerSafeReason: string;
  nextStep: string;
  tone: 'success' | 'warning' | 'danger' | 'info';
};

const REASON_COPY: Record<string, DecisionMeta> = {
  CLAIM_FILED: {
    title: 'Claim received',
    summary: 'Your claim has been logged and queued for checks.',
    workerSafeReason: 'Initial intake completed.',
    nextStep: 'Wait while trigger and fraud checks run.',
    tone: 'info',
  },
  TRIGGER_NOT_COVERED: {
    title: 'Trigger not covered',
    summary: 'The reported event type is not covered by this policy.',
    workerSafeReason: 'Policy coverage does not include this trigger.',
    nextStep: 'Review your covered trigger list on the policy card.',
    tone: 'warning',
  },
  TRIGGER_THRESHOLD_NOT_MET: {
    title: 'Trigger threshold not met',
    summary: 'Observed value is below policy trigger threshold.',
    workerSafeReason: 'Claim condition was not fully activated.',
    nextStep: 'You can file again if the event crosses the required threshold.',
    tone: 'warning',
  },
  POLICY_EXCLUSION_HIT: {
    title: 'Excluded scenario',
    summary: 'This event falls under policy exclusions.',
    workerSafeReason: 'Policy terms block payout for this case.',
    nextStep: 'Check policy terms and exclusions in your coverage details.',
    tone: 'danger',
  },
  FRAUD_AUTO_APPROVE: {
    title: 'Auto approved by decision engine',
    summary: 'Automated checks found low risk and approved your claim.',
    workerSafeReason: 'No major risk signals detected.',
    nextStep: 'Payout processing continues automatically.',
    tone: 'success',
  },
  FRAUD_SOFT_FLAG: {
    title: 'Manual review required',
    summary: 'Claim needs an operations review before payout decision.',
    workerSafeReason: 'Some checks require human verification.',
    nextStep: 'Team review will update this claim soon.',
    tone: 'warning',
  },
  FRAUD_HARD_BLOCK: {
    title: 'Claim blocked',
    summary: 'Safety and policy checks blocked this claim.',
    workerSafeReason: 'Risk checks found inconsistent claim signals.',
    nextStep: 'Contact support if you believe this is incorrect.',
    tone: 'danger',
  },
  MANUAL_APPROVAL: {
    title: 'Approved by operations',
    summary: 'Team review approved this claim.',
    workerSafeReason: 'Manual review completed with approval.',
    nextStep: 'Payout transfer should start shortly.',
    tone: 'success',
  },
  MANUAL_REJECTION: {
    title: 'Rejected by operations',
    summary: 'Team review rejected this claim.',
    workerSafeReason: 'Manual review could not validate this claim.',
    nextStep: 'Contact support for appeal details.',
    tone: 'danger',
  },
  PAYOUT_SETTLED: {
    title: 'Payout completed',
    summary: 'Transfer completed and claim is settled.',
    workerSafeReason: 'Payout callback confirmed settlement.',
    nextStep: 'Check your payout reference in claim details.',
    tone: 'success',
  },
  INVALID_TRANSITION: {
    title: 'Action conflict',
    summary: 'An invalid status update was attempted.',
    workerSafeReason: 'Claim state changed before this action completed.',
    nextStep: 'Refresh claim status and retry only if needed.',
    tone: 'warning',
  },
};

const FALLBACK: DecisionMeta = {
  title: 'Decision update',
  summary: 'Your claim decision was updated.',
  workerSafeReason: 'Decision engine produced an update.',
  nextStep: 'Open claim details for latest status and next actions.',
  tone: 'info',
};

export const getDecisionCopy = (reasonCode?: string | null): DecisionMeta => {
  if (!reasonCode) return FALLBACK;
  return REASON_COPY[reasonCode] || FALLBACK;
};

export const settlementProgress = (status?: string | null) => {
  const current = status || 'pending';
  return {
    filed: true,
    reviewed: ['approved', 'soft_flag', 'hard_block', 'paid'].includes(current),
    payoutReady: ['approved', 'paid'].includes(current),
    paid: current === 'paid',
  };
};
