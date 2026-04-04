from __future__ import annotations

from datetime import datetime
from typing import Any

import numpy as np

from .model_bundle import FraudArtifacts


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _encode_label(label_encoder: Any, value: str) -> int:
    if value in getattr(label_encoder, "classes_", []):
        return int(label_encoder.transform([value])[0])
    return 0


def _rule_risk_score(features: dict[str, float]) -> float:
    score = 0.0

    if features["policy_age_hours"] < 24:
        score += 0.30
    elif features["policy_age_hours"] < 72:
        score += 0.12

    if features["gps_distance_to_event_zone_km"] > 10:
        score += 0.25

    if features["active_hours_overlap_ratio"] < 0.20:
        score += 0.15

    if features["device_rooted_flag"] > 0 or features["mock_location_flag"] > 0:
        score += 0.20

    if features["recent_claims_same_device_24h"] >= 3:
        score += 0.15

    if features["recent_claims_same_ip_24h"] >= 5:
        score += 0.10

    return float(np.clip(score, 0.0, 1.0))


def _build_feature_row(payload: dict[str, Any], artifacts: FraudArtifacts) -> dict[str, float]:
    event_ts_raw = payload.get("event_ts")
    try:
        event_ts = datetime.fromisoformat(str(event_ts_raw)) if event_ts_raw else datetime.utcnow()
    except ValueError:
        event_ts = datetime.utcnow()

    trigger_type = str(payload.get("trigger_type", "rainfall"))
    platform = str(payload.get("platform", "other"))

    policy_age_hours = _to_float(payload.get("policy_age_hours"), 24.0)
    claim_amount = _to_float(payload.get("claim_amount"), 0.0)
    coverage_amount = max(_to_float(payload.get("coverage_amount"), 500.0), 1.0)
    trigger_value = _to_float(payload.get("trigger_value"), 0.0)
    trigger_threshold = max(_to_float(payload.get("trigger_threshold"), 1.0), 1e-6)

    income_loss_estimate = _to_float(payload.get("income_loss_estimate"), claim_amount)

    features = {
        "policy_age_hours": policy_age_hours,
        "claim_amount": claim_amount,
        "coverage_amount": coverage_amount,
        "trigger_value": trigger_value,
        "trigger_threshold": trigger_threshold,
        "trigger_gap_ratio": max(0.0, (trigger_value - trigger_threshold) / trigger_threshold),
        "is_peak_hour": float(1 if event_ts.hour in {7, 8, 9, 17, 18, 19, 20, 21} else 0),
        "weather_severity": _to_float(payload.get("weather_severity"), 2.0),
        "gps_distance_to_event_zone_km": _to_float(payload.get("gps_distance_to_event_zone_km"), 0.0),
        "active_hours_overlap_ratio": float(np.clip(_to_float(payload.get("active_hours_overlap_ratio"), 1.0), 0.0, 1.0)),
        "recent_claims_same_zone_24h": _to_float(payload.get("recent_claims_same_zone_24h"), 0.0),
        "recent_claims_same_device_24h": _to_float(payload.get("recent_claims_same_device_24h"), 0.0),
        "recent_claims_same_ip_24h": _to_float(payload.get("recent_claims_same_ip_24h"), 0.0),
        "device_rooted_flag": float(_to_int(payload.get("device_rooted_flag"), 0)),
        "mock_location_flag": float(_to_int(payload.get("mock_location_flag"), 0)),
        "gps_speed_jump_flag": float(_to_int(payload.get("gps_speed_jump_flag"), 0)),
        "payout_ratio": float(np.clip(_to_float(payload.get("payout_ratio"), 0.5), 0.0, 1.0)),
        "income_loss_estimate": max(income_loss_estimate, 0.0),
        "policy_exclusion_hit_flag": float(_to_int(payload.get("policy_exclusion_hit_flag"), 0)),
        "trigger_type_enc": _encode_label(artifacts.le_trigger, trigger_type),
        "platform_enc": _encode_label(artifacts.le_platform, platform),
        "hour": float(event_ts.hour),
        "dow": float(event_ts.weekday()),
        "month": float(event_ts.month),
    }

    features["new_policy_high_claim"] = float((features["policy_age_hours"] < 48) and (features["claim_amount"] > 150.0))
    features["device_risk_combo"] = (
        features["device_rooted_flag"] + features["mock_location_flag"] + features["gps_speed_jump_flag"]
    )
    features["velocity_24h"] = (
        features["recent_claims_same_device_24h"] + features["recent_claims_same_ip_24h"] + features["recent_claims_same_zone_24h"]
    )
    features["gps_overlap_mismatch"] = features["gps_distance_to_event_zone_km"] / (
        features["active_hours_overlap_ratio"] + 0.01
    )
    features["claim_to_income_ratio"] = features["claim_amount"] / (features["income_loss_estimate"] + 1.0)
    features["trigger_suspicion"] = float(
        (features["trigger_gap_ratio"] < 0.05) and (features["policy_age_hours"] < 100)
    )
    features["hour_sin"] = float(np.sin(2 * np.pi * features["hour"] / 24.0))
    features["hour_cos"] = float(np.cos(2 * np.pi * features["hour"] / 24.0))
    features["is_night"] = float(1 if int(features["hour"]) in {0, 1, 2, 3, 4, 5} else 0)
    features["is_weekend"] = float(1 if int(features["dow"]) in {5, 6} else 0)
    features["log_claim_amount"] = float(np.log1p(features["claim_amount"]))
    features["log_gps_distance"] = float(np.log1p(max(features["gps_distance_to_event_zone_km"], 0.0)))
    features["log_policy_age"] = float(np.log1p(max(features["policy_age_hours"], 0.0)))

    features["rule_risk_score"] = _rule_risk_score(features)
    return features


def _to_verdict(score: float) -> str:
    if score < 0.30:
        return "auto_approve"
    if score < 0.70:
        return "soft_flag"
    return "hard_block"


def _normalize_operational_score(raw_score: float, rule_score: float, iso_score: float) -> float:
    # Operational normalization keeps outputs in [0, 1] while preventing
    # score collapse into a narrow low-risk band at runtime.
    iso_norm = float(np.clip(iso_score / 1.2, 0.0, 1.0))
    blended = 0.45 * raw_score + 0.35 * rule_score + 0.20 * iso_norm

    if rule_score >= 0.80 and iso_score >= 1.0:
        blended = max(blended, 0.75)
    elif rule_score >= 0.50 and iso_score >= 0.70:
        blended = max(blended, 0.45)
    elif rule_score >= 0.10 and iso_score >= 0.80 and raw_score >= 0.11:
        # Balanced mode still escalates moderate multi-signal risk into soft review.
        blended = max(blended, 0.32)

    return float(np.clip(blended, 0.0, 1.0))


def _stacker_probability(stacker: Any, stack_vector: np.ndarray) -> float:
    """
    Return stacker fraud probability with a manual logistic fallback.

    Some serialized LogisticRegressionCV artifacts can fail in predict_proba
    across sklearn versions due internal validation API changes.
    """
    try:
        return float(stacker.predict_proba(stack_vector)[0][1])
    except Exception:
        coef = getattr(stacker, "coef_", None)
        intercept = getattr(stacker, "intercept_", None)
        if coef is None or intercept is None:
            raise

        coef_vec = np.asarray(coef, dtype=float).reshape(-1)
        intercept_scalar = float(np.asarray(intercept, dtype=float).reshape(-1)[0])
        linear = float(np.dot(stack_vector.reshape(-1), coef_vec) + intercept_scalar)
        return float(1.0 / (1.0 + np.exp(-linear)))


def score_claim(payload: dict[str, Any], artifacts: FraudArtifacts) -> dict[str, Any]:
    features = _build_feature_row(payload, artifacts)

    schema = artifacts.registry.get("feature_schema", {})
    iso_feature_names = schema.get("isolation_forest_features", [])
    fraud_augmented = schema.get("fraud_augmented_features", [])

    iso_vector = np.array([[features.get(col, 0.0) for col in iso_feature_names]], dtype=float)
    iso_raw = float(-artifacts.isolation_forest.decision_function(iso_vector)[0])
    iso_anomaly_score = float(artifacts.iso_scaler.transform([[iso_raw]])[0][0])

    features["iso_anomaly_score"] = iso_anomaly_score
    aug_vector = np.array([[features.get(col, 0.0) for col in fraud_augmented]], dtype=float)

    lgb_prob = float(artifacts.lgb_fraud_classifier.predict_proba(aug_vector)[0][1])
    calibrated_prob = float(artifacts.iso_calibrator.predict([lgb_prob])[0])

    stack_vector = np.array([[iso_anomaly_score, calibrated_prob, features["rule_risk_score"]]], dtype=float)
    raw_score = float(np.clip(_stacker_probability(artifacts.stacker, stack_vector), 0.0, 1.0))
    final_score = _normalize_operational_score(raw_score, features["rule_risk_score"], iso_anomaly_score)

    verdict = _to_verdict(final_score)

    signals = []
    if features["policy_age_hours"] < 24:
        signals.append("same_day_policy_claim")
    if features["gps_distance_to_event_zone_km"] > 10:
        signals.append("gps_outside_zone")
    if features["recent_claims_same_device_24h"] >= 3:
        signals.append("device_velocity_spike")
    if features["mock_location_flag"] > 0:
        signals.append("mock_location_detected")

    if verdict == "hard_block":
        recommendation = "REJECT"
    elif verdict == "soft_flag":
        recommendation = "FLAG_FOR_REVIEW"
    else:
        recommendation = "AUTO_APPROVE"

    return {
        "fraud_score": round(final_score, 4),
        "is_fraudulent": verdict == "hard_block",
        "verdict": verdict,
        "signals": signals,
        "recommendation": recommendation,
        "model_version": artifacts.registry.get("model_version", "unknown"),
        "evaluation_meta": {
            "iso_anomaly_score": round(iso_anomaly_score, 4),
            "calibrated_prob": round(calibrated_prob, 4),
            "rule_score": round(features["rule_risk_score"], 4),
            "raw_model_score": round(raw_score, 4),
            "operational_score": round(final_score, 4),
            "thresholds": {"auto_approve_lt": 0.30, "soft_flag_lt": 0.70},
        },
    }
