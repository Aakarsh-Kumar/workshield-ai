# WorkShield ML Pipeline — Export Package

Production-grade risk scoring and fraud detection pipeline for gig-worker income protection.

## Directory Structure

```
workshield_export/
├── data/claims/          # Synthetic datasets (4 CSVs)
│   ├── worker_hourly_dataset_v2.csv      (2.2M rows, 314 MB)
│   ├── worker_weekly_risk_dataset_v2.csv  (21K rows, 2.1 MB)
│   ├── synthetic_claims_dataset_v2.csv    (108K rows, 8.6 MB)
│   └── fraud_model_dataset_v2.csv         (108K rows, 16.6 MB)
├── models/               # Serialized models + registry
│   ├── model_registry_v2.json             (version, features, metrics)
│   ├── lgb_hourly_income.joblib
│   ├── lgb_risk_score.joblib
│   ├── lgb_weekly_premium.joblib
│   ├── lgb_event_impact.joblib
│   ├── isolation_forest.joblib
│   ├── lgb_fraud_classifier.joblib
│   ├── iso_scaler.joblib
│   ├── iso_calibrator.joblib
│   ├── stacker.joblib
│   ├── le_trigger.joblib
│   └── le_platform.joblib
├── notebooks/
│   └── workshield_pipeline_v2.ipynb       (fully executed)
├── scripts/
│   ├── workshield_pipeline_v2.py          (pipeline source)
│   └── preprocess_v2.py                   (data generation)
├── docs/
│   ├── DATASET_CARD_V2.md
│   ├── FEATURE_DICTIONARY_V2.md
│   ├── SCENARIO_CATALOG_V2.md
│   ├── MODEL_BASELINE_REPORT_V2.md
│   └── *.png                              (analysis charts)
├── requirements.txt
└── README.md
```

## Quick Start

```bash
# 1. Create virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Linux/Mac

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the pipeline
jupyter notebook notebooks/workshield_pipeline_v2.ipynb
```

## Model Version

- **Version:** v2.1.0
- **Seed:** 42 (fully reproducible)
- **Python:** 3.11

## Key Metrics

| Module | Metric | Value |
|--------|--------|-------|
| Hourly Income | R² | 0.465 |
| Fraud Detection | ROC-AUC | 0.792 |
| Fraud Detection | PR-AUC | 0.271 |
| Fraud Detection | F1 | 0.401 |
| Fraud Detection | FPR | 0.303 |

## Verdict Buckets

| Verdict | Score Range |
|---------|------------|
| auto_approve | < 0.30 |
| soft_flag | 0.30 – 0.70 |
| hard_block | ≥ 0.70 |

## Integration Notes

1. **Load models:** `joblib.load("models/lgb_fraud_classifier.joblib")`
2. **Feature schema:** See `models/model_registry_v2.json` → `feature_schema`
3. **Batch scoring:** Use `WorkShieldBatchScorer` class from `scripts/workshield_pipeline_v2.py`
4. **Data regeneration:** Run `python scripts/preprocess_v2.py` (requires `hour.csv` from UCI Bike Sharing)
