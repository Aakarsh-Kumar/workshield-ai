const { SETTLEMENT_STATUS, REASON_CODES } = require('../constants/decisionContract');

const SIGNAL_LABELS = {
  same_day_policy_claim: 'Policy was purchased very close to the claim event',
  policy_purchased_same_day: 'Policy was purchased on the same day as the claim event',
  policy_very_new: 'Policy is still very new',
  gps_outside_zone: 'Claim location is materially away from the verified event area',
  device_velocity_spike: 'Too many similar claims were created from the same operational pattern in a short period',
  mock_location_detected: 'Location evidence shows signs of spoofing or manipulation',
  claim_amount_very_high: 'Claim amount is much higher than expected for the worker profile',
  claim_amount_elevated: 'Claim amount is elevated versus expected earnings',
  near_zero_delivery_activity: 'Worker activity is unusually low for the submitted claim',
  trigger_value_at_threshold_boundary: 'Observed trigger value sits right at the payout threshold',
  impossible_travel_detected: 'Travel distance and time do not look physically plausible',
  repeated_route_claim_cluster: 'The same route pattern is showing repeated claims in a short window',
  nearby_claim_cluster: 'A dense claim cluster was detected near the same event location',
  telemetry_device_churn: 'Device or browser session changed unusually often before the claim',
  offline_sync_heavy: 'A large share of evidence arrived through delayed offline sync',
  suspicious_session_reset: 'Session telemetry reset unusually often during the claim window',
};

const REVIEWER_PLAYBOOKS = {
  rainfall: [
    'Confirm rainfall evidence source, timestamp, and the worker ping nearest to the observed event.',
    'Check whether the event location is materially aligned with the verified rainfall location and zone.',
    'Review telemetry continuity to make sure the same device/session was active through the evidence window.',
  ],
  traffic_congestion: [
    'Validate route coverage, trip duration, and whether enough pings exist across the selected window.',
    'Compare route signature, nearby claim clustering, and impossible-travel signals before approving.',
    'Check for abrupt device/session changes that could indicate route replay or synthetic location evidence.',
  ],
  platform_outage: [
    'Confirm outage window boundaries and whether the claim is still awaiting manual verification evidence.',
    'Review session continuity and offline-sync share during the outage window to rule out delayed fabricated uploads.',
    'Cross-check repeated same-device or same-route claims before approving a platform disruption payout.',
  ],
  vehicle_accident: [
    'Confirm supporting documents and whether reviewer notes explicitly justify manual approval or rejection.',
    'Check location continuity before and after the reported incident for spoofing or impossible movement.',
    'Review prior payout attempts and fraud signals to ensure a blocked claim is not being retried inconsistently.',
  ],
  hospitalization: [
    'Verify the documented treatment window and ensure reviewer rationale references the received evidence.',
    'Check for suspicious location/session resets around filing time that could indicate account misuse.',
    'Confirm there are no unresolved payout or fraud conflicts before moving a hospitalized worker to approval.',
  ],
};

function humanizeSignal(signal) {
  return SIGNAL_LABELS[signal] || signal.replaceAll('_', ' ');
}

function deriveVerificationState(claim) {
  const verification = claim?.evaluationMeta?.verification || {};
  const reasonCode = claim?.reasonCode;

  if (reasonCode === REASON_CODES.POLICY_EXCLUSION_HIT || reasonCode === REASON_CODES.TRIGGER_NOT_COVERED) {
    return 'blocked';
  }
  if (reasonCode === REASON_CODES.TRIGGER_THRESHOLD_NOT_MET) {
    return 'threshold_not_met';
  }
  if (verification.requiresManualReview) {
    return 'manual_review';
  }
  if (verification.source) {
    return 'verified';
  }
  return 'evidence_pending';
}

function deriveFraudState(claim) {
  if (!claim?.fraudModelVersion) return 'not_scored';
  if (claim?.fraudVerdict === 'hard_block') return 'hard_block';
  if (claim?.fraudVerdict === 'soft_flag') return 'soft_flag';
  if (claim?.fraudVerdict === 'auto_approve') return 'cleared';
  return 'not_scored';
}

function derivePayoutState(claim) {
  const settlement = claim?.settlementStatus || claim?.status;
  if (settlement === SETTLEMENT_STATUS.PAID || settlement === 'paid') return 'paid';
  if (settlement === SETTLEMENT_STATUS.APPROVED || settlement === 'approved') return 'ready';
  if (settlement === SETTLEMENT_STATUS.SOFT_FLAG || settlement === 'under_review') return 'review_hold';
  if (settlement === SETTLEMENT_STATUS.HARD_BLOCK || settlement === 'rejected') return 'blocked';
  return 'not_ready';
}

function buildReviewerReasons(claim) {
  const reasons = [];
  const verification = claim?.evaluationMeta?.verification || {};
  const fraudMeta = claim?.evaluationMeta?.fraud || {};

  if (verification.reason) {
    reasons.push({
      type: 'verification',
      label: 'Verification hold',
      detail: verification.reason,
    });
  }

  const signals = Array.isArray(claim?.fraudSignals) && claim.fraudSignals.length > 0
    ? claim.fraudSignals
    : Array.isArray(fraudMeta.ruleHits) ? fraudMeta.ruleHits : [];

  signals.forEach((signal) => {
    reasons.push({
      type: 'fraud',
      label: 'Fraud signal',
      detail: humanizeSignal(signal),
      code: signal,
    });
  });

  if (claim?.reasonDetail) {
    reasons.push({
      type: 'decision',
      label: 'Current decision',
      detail: claim.reasonDetail,
      code: claim.reasonCode,
    });
  }

  const operationalSignals = fraudMeta.operationalSignals || {};
  if (Number(operationalSignals.impossibleTravelFlag || 0) > 0) {
    reasons.push({
      type: 'fraud',
      label: 'Operational anomaly',
      detail: humanizeSignal('impossible_travel_detected'),
      code: 'impossible_travel_detected',
    });
  }
  if (Number(operationalSignals.recentClaimsSameRoute24h || 0) >= 2 || Number(operationalSignals.repeatedRouteClaims7d || 0) >= 3) {
    reasons.push({
      type: 'fraud',
      label: 'Operational anomaly',
      detail: humanizeSignal('repeated_route_claim_cluster'),
      code: 'repeated_route_claim_cluster',
    });
  }
  if (Number(operationalSignals.clusterClaims24h || 0) >= 3) {
    reasons.push({
      type: 'fraud',
      label: 'Operational anomaly',
      detail: humanizeSignal('nearby_claim_cluster'),
      code: 'nearby_claim_cluster',
    });
  }

  return reasons;
}

function buildFraudTimeline(claim) {
  const timeline = [];
  const fraudMeta = claim?.evaluationMeta?.fraud || {};
  const verification = claim?.evaluationMeta?.verification || {};

  if (claim?.createdAt) {
    timeline.push({
      id: 'claim-filed',
      stage: 'filed',
      at: claim.createdAt,
      title: 'Claim filed',
      detail: 'Claim record was created and queued for evidence and fraud assessment.',
    });
  }

  if (verification.source || verification.reason) {
    timeline.push({
      id: 'verification',
      stage: 'verification',
      at: fraudMeta.timestamp || claim?.createdAt,
      title: verification.requiresManualReview ? 'Verification requires manual review' : 'Evidence verification completed',
      detail: verification.reason || `Verification source: ${verification.source || 'unknown'}`,
    });
  }

  if (claim?.fraudModelVersion) {
    timeline.push({
      id: 'fraud-score',
      stage: 'fraud',
      at: fraudMeta.timestamp || claim?.processedAt || claim?.createdAt,
      title: 'Fraud scoring completed',
      detail: `Model ${claim.fraudModelVersion} returned ${claim.fraudVerdict || 'no verdict'} with score ${Number(claim.fraudScore || 0).toFixed(2)}.`,
    });
  }

  if (claim?.processedAt || claim?.settlementStatus) {
    timeline.push({
      id: 'settlement',
      stage: 'settlement',
      at: claim.processedAt || claim.createdAt,
      title: 'Settlement state updated',
      detail: `Current payout state: ${derivePayoutState(claim).replaceAll('_', ' ')}.`,
    });
  }

  return timeline;
}

function buildReviewerPlaybook(claim) {
  const claimTriggerType = claim?.triggerType || 'rainfall';
  const baseSteps = REVIEWER_PLAYBOOKS[claimTriggerType] || REVIEWER_PLAYBOOKS.rainfall;
  const reasons = buildReviewerReasons(claim);
  const reasonDrivenSteps = [];

  if (reasons.some((reason) => reason.code === 'impossible_travel_detected')) {
    reasonDrivenSteps.push('Inspect preceding and following ping locations to confirm whether movement was physically plausible.');
  }
  if (reasons.some((reason) => reason.code === 'nearby_claim_cluster')) {
    reasonDrivenSteps.push('Review nearby same-event claims together to separate a genuine local event from coordinated abuse.');
  }
  if (reasons.some((reason) => reason.code === 'telemetry_device_churn' || reason.code === 'suspicious_session_reset')) {
    reasonDrivenSteps.push('Verify whether device IDs and session IDs rotated unusually often compared with the worker’s recent history.');
  }
  if (claim?.evaluationMeta?.verification?.requiresManualReview) {
    reasonDrivenSteps.push('Do not auto-approve until manual verification evidence is attached or the reviewer documents why an override is safe.');
  }

  return Array.from(new Set([...baseSteps, ...reasonDrivenSteps])).map((step, index) => ({
    id: `${claimTriggerType}-playbook-${index + 1}`,
    step,
  }));
}

function enrichClaimRecord(record) {
  const claim = typeof record?.toObject === 'function' ? record.toObject() : { ...record };
  const reviewerReasons = buildReviewerReasons(claim);
  return {
    ...claim,
    verificationState: deriveVerificationState(claim),
    fraudState: deriveFraudState(claim),
    payoutState: derivePayoutState(claim),
    reviewerReasons,
    fraudTimeline: buildFraudTimeline(claim),
    reviewerPlaybook: buildReviewerPlaybook(claim),
    lifecycle: {
      eventVerification: deriveVerificationState(claim),
      fraudReview: deriveFraudState(claim),
      payoutOrchestration: derivePayoutState(claim),
    },
  };
}

module.exports = {
  enrichClaimRecord,
  deriveVerificationState,
  deriveFraudState,
  derivePayoutState,
  buildReviewerReasons,
  buildReviewerPlaybook,
};
