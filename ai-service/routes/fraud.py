from flask import Blueprint, request, jsonify

fraud_bp = Blueprint('fraud', __name__)

# Trigger-type thresholds (must mirror backend/services/triggerService.js)
TRIGGER_THRESHOLDS = {
    'rainfall': 50,
    'platform_outage': 4,
    'vehicle_accident': 1,
    'hospitalization': 1,
}


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

    fraud_score, signals = compute_fraud_score(claim)
    is_fraudulent = fraud_score >= 0.50

    if fraud_score >= 0.50:
        recommendation = 'REJECT'
    elif fraud_score >= 0.30:
        recommendation = 'FLAG_FOR_REVIEW'
    else:
        recommendation = 'AUTO_APPROVE'

    return jsonify({
        'fraud_score':    fraud_score,
        'is_fraudulent':  is_fraudulent,
        'signals':        signals,
        'recommendation': recommendation,
        'claim_id':       claim.get('claim_id'),
    })
