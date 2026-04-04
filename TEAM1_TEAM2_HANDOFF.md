# Team 1 to Team 2 Handoff Contract

Date: 4 April 2026
Mode: Balanced runtime posture

## Data and Model Source

1. Training and calibration datasets are maintained outside the public repository.
2. Runtime model artifacts are provisioned through private deployment channels.
3. Active model version is exposed via `GET /ai/fraud-model-status`.
4. Team 2 should treat endpoint responses as the integration source of truth.

## Required Decision Fields (Team 2 Consumes)

Every finalized fraud/settlement decision payload includes:
1. verdict
2. reasonCode
3. reasonDetail
4. fraudScore
5. settlementStatus
6. payoutEligibility
7. evaluationMeta

## Reason Codes

1. CLAIM_FILED
2. TRIGGER_NOT_COVERED
3. TRIGGER_THRESHOLD_NOT_MET
4. POLICY_EXCLUSION_HIT
5. FRAUD_AUTO_APPROVE
6. FRAUD_SOFT_FLAG
7. FRAUD_HARD_BLOCK
8. MANUAL_APPROVAL
9. MANUAL_REJECTION
10. PAYOUT_SETTLED
11. INVALID_TRANSITION

## Settlement State Machine

Valid transitions:
1. pending -> approved
2. pending -> soft_flag
3. pending -> hard_block
4. approved -> paid
5. soft_flag -> approved
6. soft_flag -> hard_block

Invalid transitions:
1. Any transition outside the valid set returns HTTP 409 with reasonCode INVALID_TRANSITION.

## Team 2 Relevant Endpoints

1. GET /ai/fraud-model-status
- Fraud model artifact status and version.

2. GET /ai/premium-model-status
- Premium model artifact status and version.

3. POST /ai/fraud-check
- Returns fraud score, verdict, contract fields, and evaluation metadata.

4. POST /ai/predict
- Model-backed premium inference with fallback-safe contract.

5. PATCH /api/claims/:id/paid (admin)
- Team 2 payout callback to mark approved claim as paid.
- Body: { payoutReference, paidAmount?, remarks? }

## Threshold Policy (Balanced)

Runtime verdict buckets:
1. auto_approve: score < 0.30
2. soft_flag: 0.30 <= score < 0.70
3. hard_block: score >= 0.70

Notes:
1. model_registry threshold_used is model-selection threshold and not the runtime policy bucket boundary.
2. Runtime score is normalized to [0, 1] and then bucketed by fixed policy thresholds.

## Payout Orchestration Contract

Team 2 payout worker should:
1. Read only claims with settlementStatus approved and payoutEligibility true.
2. Execute payout transfer.
3. Call PATCH /api/claims/:id/paid with payoutReference.
4. Persist returned claim fields as source of truth for payout completion.

If payout callback fails with INVALID_TRANSITION:
1. Treat as non-retryable state conflict.
2. Re-fetch claim status and reconcile locally.
