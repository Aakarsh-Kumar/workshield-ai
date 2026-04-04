from __future__ import annotations

import json
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib


_LOAD_ERROR: str | None = None
_PREMIUM_LOAD_ERROR: str | None = None


@dataclass
class FraudArtifacts:
    registry: dict[str, Any]
    isolation_forest: Any
    iso_scaler: Any
    lgb_fraud_classifier: Any
    iso_calibrator: Any
    stacker: Any
    le_trigger: Any
    le_platform: Any


@dataclass
class PremiumArtifacts:
    registry: dict[str, Any]
    lgb_weekly_premium: Any
    lgb_risk_score: Any
    le_platform: Any


_REQUIRED_MODEL_FILES = {
    "isolation_forest": "isolation_forest.joblib",
    "iso_scaler": "iso_scaler.joblib",
    "lgb_fraud_classifier": "lgb_fraud_classifier.joblib",
    "iso_calibrator": "iso_calibrator.joblib",
    "stacker": "stacker.joblib",
    "le_trigger": "le_trigger.joblib",
    "le_platform": "le_platform.joblib",
}


_PREMIUM_REQUIRED_MODEL_FILES = {
    "lgb_weekly_premium": "lgb_weekly_premium.joblib",
    "lgb_risk_score": "lgb_risk_score.joblib",
    "le_platform": "le_platform.joblib",
}


def _resolve_export_root() -> Path:
    # Docker: /ml-export; local fallback: ../workshield_export from ai-service/
    configured = os.getenv("WORKSHIELD_EXPORT_ROOT", "/ml-export")
    root = Path(configured)
    if root.exists():
        return root

    local_fallback = Path(__file__).resolve().parents[2] / "workshield_export"
    return local_fallback


def _load_registry(models_dir: Path) -> dict[str, Any]:
    registry_path = models_dir / "model_registry_v2.json"
    if not registry_path.exists():
        raise FileNotFoundError(f"Missing registry: {registry_path}")

    with registry_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _load_joblib(models_dir: Path, filename: str) -> Any:
    file_path = models_dir / filename
    if not file_path.exists():
        raise FileNotFoundError(f"Missing model artifact: {file_path}")
    return joblib.load(file_path)


@lru_cache(maxsize=1)
def load_fraud_artifacts() -> FraudArtifacts | None:
    global _LOAD_ERROR
    export_root = _resolve_export_root()
    models_dir = export_root / "models"

    try:
        registry = _load_registry(models_dir)
        loaded = {
            key: _load_joblib(models_dir, file_name)
            for key, file_name in _REQUIRED_MODEL_FILES.items()
        }

        # Compatibility shim for serialized LogisticRegressionCV objects
        # across minor sklearn version changes.
        if not hasattr(loaded["stacker"], "multi_class"):
            loaded["stacker"].multi_class = "auto"

        artifacts = FraudArtifacts(
            registry=registry,
            isolation_forest=loaded["isolation_forest"],
            iso_scaler=loaded["iso_scaler"],
            lgb_fraud_classifier=loaded["lgb_fraud_classifier"],
            iso_calibrator=loaded["iso_calibrator"],
            stacker=loaded["stacker"],
            le_trigger=loaded["le_trigger"],
            le_platform=loaded["le_platform"],
        )
        _LOAD_ERROR = None
        return artifacts
    except Exception as exc:
        _LOAD_ERROR = str(exc)
        print(f"[FraudArtifacts] Falling back to heuristic mode: {exc}")
        return None


def get_artifact_status() -> dict[str, Any]:
    # Backward-compatible alias for fraud artifact status.
    return get_fraud_artifact_status()


def get_fraud_artifact_status() -> dict[str, Any]:
    export_root = _resolve_export_root()
    models_dir = export_root / "models"
    registry_path = models_dir / "model_registry_v2.json"

    artifacts = load_fraud_artifacts()
    return {
        "mode": "model" if artifacts else "heuristic_fallback",
        "export_root": str(export_root),
        "models_dir": str(models_dir),
        "registry_found": registry_path.exists(),
        "model_version": artifacts.registry.get("model_version") if artifacts else None,
        "load_error": _LOAD_ERROR,
    }


@lru_cache(maxsize=1)
def load_premium_artifacts() -> PremiumArtifacts | None:
    global _PREMIUM_LOAD_ERROR
    export_root = _resolve_export_root()
    models_dir = export_root / "models"

    try:
        registry = _load_registry(models_dir)
        loaded = {
            key: _load_joblib(models_dir, file_name)
            for key, file_name in _PREMIUM_REQUIRED_MODEL_FILES.items()
        }

        artifacts = PremiumArtifacts(
            registry=registry,
            lgb_weekly_premium=loaded["lgb_weekly_premium"],
            lgb_risk_score=loaded["lgb_risk_score"],
            le_platform=loaded["le_platform"],
        )
        _PREMIUM_LOAD_ERROR = None
        return artifacts
    except Exception as exc:
        _PREMIUM_LOAD_ERROR = str(exc)
        print(f"[PremiumArtifacts] Falling back to heuristic mode: {exc}")
        return None


def get_premium_artifact_status() -> dict[str, Any]:
    export_root = _resolve_export_root()
    models_dir = export_root / "models"
    registry_path = models_dir / "model_registry_v2.json"

    artifacts = load_premium_artifacts()
    return {
        "mode": "model" if artifacts else "heuristic_fallback",
        "export_root": str(export_root),
        "models_dir": str(models_dir),
        "registry_found": registry_path.exists(),
        "model_version": artifacts.registry.get("model_version") if artifacts else None,
        "load_error": _PREMIUM_LOAD_ERROR,
    }
