from flask import Blueprint, request, jsonify

from services.model_bundle import get_premium_artifact_status, load_premium_artifacts
from services.premium_inference import predict_weekly_premium

risk_bp = Blueprint('risk', __name__)

# Platform-specific risk multipliers based on Indian delivery market data.
# Blinkit has higher delivery frequency (10-min grocery), hence higher risk.
PLATFORM_RISK_MULTIPLIERS = {
    'swiggy':  1.00,
    'zomato':  1.00,
    'blinkit': 1.20,  # Higher frequency, more road exposure
    'dunzo':   1.10,
    'other':   1.15,
}


def calculate_premium(weekly_deliveries: int, platform: str, risk_score: float) -> float:
    """
    Actuarial parametric premium calculation.

    Formula:
        premium = BASE_RATE × delivery_load_factor × platform_multiplier × (1 + risk_loading)

    In production, replace with a trained gradient-boosted regression model
    (XGBoost / LightGBM) fitted on historical claims data.

    Args:
        weekly_deliveries: Number of deliveries per week (0–200)
        platform:          Gig platform name
        risk_score:        AI-assigned risk score (0.0–1.0)

    Returns:
        Weekly premium in INR, capped at 500
    """
    BASE_RATE = 45.0   # INR — floor premium for minimal delivery activity
    MAX_PREMIUM = 500.0

    # Non-linear load factor — risk grows faster at high delivery volumes
    if weekly_deliveries <= 10:
        load_factor = 0.80
    elif weekly_deliveries <= 20:
        load_factor = 1.00
    elif weekly_deliveries <= 40:
        load_factor = 1.30
    else:
        load_factor = 1.60

    platform_multiplier = PLATFORM_RISK_MULTIPLIERS.get(platform.lower(), 1.15)

    # Risk loading: up to +50% for maximum risk score
    risk_loading = risk_score * 0.50

    premium = BASE_RATE * load_factor * platform_multiplier * (1.0 + risk_loading)
    return round(min(premium, MAX_PREMIUM), 2)


@risk_bp.route('/predict', methods=['POST'])
def predict_premium():
    """
    POST /predict

    Request body:
        {
          "weekly_deliveries": 30,
          "platform": "swiggy",
          "risk_score": 0.4
        }

    Response:
        {
          "premium": 87.75,
          "currency": "INR",
          "breakdown": { ... }
        }
    """
    data = request.get_json(force=True) or {}

    weekly_deliveries = int(data.get('weekly_deliveries', 20))
    platform = str(data.get('platform', 'other')).strip()
    risk_score = float(data.get('risk_score', 0.5))

    # Clamp to safe ranges
    weekly_deliveries = max(0, min(weekly_deliveries, 200))
    risk_score = max(0.0, min(risk_score, 1.0))

    artifacts = load_premium_artifacts()
    if artifacts:
        try:
            response = predict_weekly_premium(weekly_deliveries, platform, risk_score, artifacts)
            return jsonify(response)
        except Exception as exc:
            print(f'[RiskRoute] Model premium inference failed, using fallback: {exc}')

    premium = calculate_premium(weekly_deliveries, platform, risk_score)
    return jsonify({
        'premium': premium,
        'currency': 'INR',
        'breakdown': {
            'base_rate': 45.0,
            'weekly_deliveries': weekly_deliveries,
            'platform': platform,
            'risk_score': risk_score,
            'platform_multiplier': PLATFORM_RISK_MULTIPLIERS.get(platform.lower(), 1.15),
            'mode': 'heuristic_fallback',
            'model_version': None,
        },
    })


@risk_bp.route('/premium-model-status', methods=['GET'])
def premium_model_status():
    return jsonify(get_premium_artifact_status())
