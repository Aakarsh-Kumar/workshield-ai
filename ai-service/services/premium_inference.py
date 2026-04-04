from __future__ import annotations

from datetime import datetime
from typing import Any

import numpy as np

from .model_bundle import PremiumArtifacts


_PLATFORM_INCOME_PRIOR = {
    "swiggy": 84.0,
    "zomato": 84.0,
    "blinkit": 81.0,
    "zepto": 84.5,
    "dunzo": 83.0,
    "other": 83.0,
}


def _clamp(value: float, lower: float, upper: float) -> float:
    return float(np.clip(value, lower, upper))


def _encode_label(label_encoder: Any, value: str) -> int:
    if value in getattr(label_encoder, "classes_", []):
        return int(label_encoder.transform([value])[0])
    return int(label_encoder.transform([label_encoder.classes_[0]])[0])


def _synthesize_risk_features(
    weekly_deliveries: int,
    platform: str,
    risk_score: float,
    artifacts: PremiumArtifacts,
) -> dict[str, float]:
    deliveries = int(_clamp(float(weekly_deliveries), 0, 200))
    risk = _clamp(float(risk_score), 0.0, 1.0)
    platform_name = str(platform or "other").strip().lower()

    platform_enc = _encode_label(artifacts.le_platform, platform_name)
    month = float(datetime.utcnow().month)

    # Runtime feature synthesis keeps values inside training distribution
    # for weekly risk model inputs.
    hours_worked = _clamp(72.0 + deliveries * 1.2, 11.0, 128.0)
    peak_hours_share = _clamp(0.26 + 0.0012 * deliveries + 0.12 * risk, 0.1818, 0.5556)

    base_income = _PLATFORM_INCOME_PRIOR.get(platform_name, _PLATFORM_INCOME_PRIOR["other"])
    avg_hourly_income = _clamp(base_income * (1.0 - 0.12 * risk), 6.658, 220.3617)

    total_income = _clamp(hours_worked * avg_hourly_income, 158.51, 24680.51)

    event_prob_estimate = _clamp(0.02 + 0.30 * risk + 0.04 * (deliveries / 200.0), 0.0, 0.4141)
    disruption_hours = _clamp(round(hours_worked * event_prob_estimate), 0.0, 41.0)

    total_income_loss = _clamp(
        disruption_hours * avg_hourly_income * (0.55 + 0.15 * risk),
        0.0,
        3859.67,
    )

    worker_id = float(int(_clamp(1 + ((deliveries * 5 + int(risk * 100) + platform_enc * 11) % 200), 1, 200)))

    return {
        "worker_id": worker_id,
        "hours_worked": hours_worked,
        "peak_hours_share": peak_hours_share,
        "avg_hourly_income": avg_hourly_income,
        "total_income": total_income,
        "disruption_hours": disruption_hours,
        "total_income_loss": total_income_loss,
        "event_prob_estimate": event_prob_estimate,
        "platform_enc": float(platform_enc),
        "month": month,
    }


def predict_weekly_premium(
    weekly_deliveries: int,
    platform: str,
    risk_score: float,
    artifacts: PremiumArtifacts,
) -> dict[str, Any]:
    risk_features = _synthesize_risk_features(weekly_deliveries, platform, risk_score, artifacts)

    feature_schema = artifacts.registry.get("feature_schema", {})
    risk_feature_names = feature_schema.get(
        "risk_features",
        [
            "worker_id",
            "hours_worked",
            "peak_hours_share",
            "avg_hourly_income",
            "total_income",
            "disruption_hours",
            "total_income_loss",
            "event_prob_estimate",
            "platform_enc",
            "month",
        ],
    )

    vector = np.array([[risk_features.get(col, 0.0) for col in risk_feature_names]], dtype=float)

    predicted_risk = float(np.clip(artifacts.lgb_risk_score.predict(vector)[0], 0.0, 1.0))
    premium = float(np.clip(artifacts.lgb_weekly_premium.predict(vector)[0], 10.0, 500.0))

    return {
        "premium": round(premium, 2),
        "currency": "INR",
        "breakdown": {
            "base_rate": 45.0,
            "weekly_deliveries": int(_clamp(float(weekly_deliveries), 0, 200)),
            "platform": str(platform or "other").strip(),
            "risk_score": _clamp(float(risk_score), 0.0, 1.0),
            "platform_multiplier": 1.0,
            "mode": "model",
            "model_version": artifacts.registry.get("model_version", "unknown"),
            "predicted_risk_score": round(predicted_risk, 4),
            "feature_vector": {k: round(float(v), 4) for k, v in risk_features.items()},
        },
    }
