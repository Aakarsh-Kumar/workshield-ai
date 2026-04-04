from datetime import datetime, timezone

from flask import Blueprint, request, jsonify

from services.fraud_inference import score_claim
from services.model_bundle import get_artifact_status, load_fraud_artifacts

fraud_bp = Blueprint('fraud', __name__)

# Trigger-type thresholds (must mirror backend/services/triggerService.js)
TRIGGER_THRESHOLDS = {
    'rainfall': 50,
    'platform_outage': 4,
    'vehicle_accident': 1,
    'hospitalization': 1,
}

VERDICT_REASON_CODES = {
    'auto_approve': 'FRAUD_AUTO_APPROVE',
    'soft_flag': 'FRAUD_SOFT_FLAG',
    'hard_block': 'FRAUD_HARD_BLOCK',
}


def _settlement_status_from_verdict(verdict: str) -> str:
    if verdict == 'hard_block':
        return 'hard_block'
    if verdict == 'soft_flag':
        return 'soft_flag'
    return 'approved'


def _contract_reason_detail(verdict: str, signals: list[str]) -> str:
    if verdict == 'hard_block':
        return 'High fraud risk; claim blocked for payout.'
    if verdict == 'soft_flag':
        return 'Medium fraud risk; manual review required before payout.'
    if signals:
        return f'Auto-approved with monitor signals: {", ".join(signals)}'
    return 'Auto-approved with no high-risk fraud indicators.'


def _attach_contract_fields(response: dict) -> dict:
    verdict = str(response.get('verdict', 'auto_approve'))
    fraud_score = float(response.get('fraud_score', 0.0))
    signals = response.get('signals') if isinstance(response.get('signals'), list) else []
    model_version = str(response.get('model_version', 'unknown'))

    reason_code = VERDICT_REASON_CODES.get(verdict, 'FRAUD_AUTO_APPROVE')
    reason_detail = _contract_reason_detail(verdict, signals)
    settlement_status = _settlement_status_from_verdict(verdict)
    payout_eligibility = settlement_status == 'approved'

    evaluation_meta = response.get('evaluation_meta', {})
    if not isinstance(evaluation_meta, dict):
        evaluation_meta = {}

    evaluation_meta.setdefault('modelVersion', model_version)
    evaluation_meta.setdefault('ruleHits', signals)
    evaluation_meta.setdefault('timestamp', datetime.now(timezone.utc).isoformat())

    response['reasonCode'] = reason_code
    response['reasonDetail'] = reason_detail
    response['fraudScore'] = fraud_score
    response['settlementStatus'] = settlement_status
    response['payoutEligibility'] = payout_eligibility
    response['evaluationMeta'] = evaluation_meta
    response['responseContractVersion'] = 'v1'
    response['evaluation_meta'] = evaluation_meta

    return response


def compute_fraud_score(claim: dict) -> tuple[float, list[str]]:
    """
    Heuristic fraud scoring for Indian gig-worker parametric insurance claims.

    Returns a score in [0.0, 1.0] and a list of fired signal names.

    Fraud patterns targeted:
      1. Policy taken moments before a known trigger event (moral hazard)
      2. Claim amount outsized relative to worker earnings profile
      3. Ghost workers: registered but barely active, then immediately claims
      4. Trigger value reported suspiciously close to the payout threshold
      5. Platform mismatch patterns

    In production, replace/augment with a trained scikit-learn / XGBoost
    classifier trained on historical labelled claims.
    """
    score = 0.0
    signals: list[str] = []

    # ── Signal 1: Policy age at time of claim ─────────────────────────────────
    policy_age_days = float(claim.get('policy_age_days', 7))
    if policy_age_days < 1:
        score += 0.40
        signals.append('policy_purchased_same_day')
    elif policy_age_days < 3:
        score += 0.20
        signals.append('policy_very_new')

    # ── Signal 2: Claim amount vs. expected daily earnings ────────────────────
    claim_amount = float(claim.get('claim_amount', 0))
    if claim_amount > 10_000:
        score += 0.25
        signals.append('claim_amount_very_high')
    elif claim_amount > 5_000:
        score += 0.10
        signals.append('claim_amount_elevated')

    # ── Signal 3: Low delivery activity (ghost worker pattern) ────────────────
    weekly_deliveries = float(claim.get('user_weekly_deliveries', 20))
    if weekly_deliveries < 3:
        score += 0.20
        signals.append('near_zero_delivery_activity')

    # ── Signal 4: Trigger value suspiciously close to threshold ──────────────
    trigger_type = str(claim.get('trigger_type', ''))
    trigger_value = float(claim.get('trigger_value', 0))
    threshold = TRIGGER_THRESHOLDS.get(trigger_type, 0)

    if threshold > 0 and abs(trigger_value - threshold) <= 1:
        score += 0.15
        signals.append('trigger_value_at_threshold_boundary')

    return round(min(score, 1.0), 4), signals


def _fallback_response(claim: dict, error: str | None = None) -> dict:
    fraud_score, signals = compute_fraud_score(claim)

    if fraud_score >= 0.70:
        verdict = 'hard_block'
        recommendation = 'REJECT'
    elif fraud_score >= 0.30:
        verdict = 'soft_flag'
        recommendation = 'FLAG_FOR_REVIEW'
    else:
        verdict = 'auto_approve'
        recommendation = 'AUTO_APPROVE'

    return _attach_contract_fields({
        'fraud_score': fraud_score,
        'is_fraudulent': verdict == 'hard_block',
        'verdict': verdict,
        'signals': signals,
        'recommendation': recommendation,
        'model_version': 'heuristic-fallback',
        'evaluation_meta': {
            'mode': 'heuristic_fallback',
            'fallback_error': error,
            'thresholds': {'auto_approve_lt': 0.30, 'soft_flag_lt': 0.70},
        },
    })


@fraud_bp.route('/fraud-model-status', methods=['GET'])
def fraud_model_status():
    return jsonify(get_artifact_status())


@fraud_bp.route('/fraud-check', methods=['POST'])
def fraud_check():
    """
    POST /fraud-check

    Request body:
        {
          "claim_id":               "...",
          "trigger_type":           "rainfall",
          "trigger_value":          52,
          "claim_amount":           500,
          "user_weekly_deliveries": 25,
          "policy_age_days":        5,
          "platform":               "swiggy"
        }

    Response:
        {
          "fraud_score":    0.0,
          "is_fraudulent":  false,
          "signals":        [],
          "recommendation": "AUTO_APPROVE",
          "claim_id":       "..."
        }
    """
    claim = request.get_json(force=True) or {}

    artifacts = load_fraud_artifacts()
    if artifacts:
        try:
            response = score_claim(claim, artifacts)
        except Exception as exc:
            print(f'[FraudRoute] Model scoring failed, using fallback: {exc}')
            response = _fallback_response(claim, str(exc))
    else:
        response = _fallback_response(claim, 'model_artifacts_unavailable')

    response = _attach_contract_fields(response)
    response['claim_id'] = claim.get('claim_id')
    return jsonify(response)
