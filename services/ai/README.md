# FinGuard AI Service

The AI service provides credit risk assessment capabilities for the FinGuard platform.

## Architecture

- **FastAPI**: Serves predictions and management endpoints.
- **Random Forest**: Best performing model selected for credit risk classification.
- **SHAP**: Used for explainability (with rule-based fallback).
- **Metadata Management**: Model versioning and feature importance tracking.

## Model Lifecycle

1.  **Training**: `train.py` runs experiments on dataset.
2.  **Versioning**: Models are versioned (e.g., 1.0.0 -> 1.1.0).
3.  **Registry**: `model_registry.py` handles model loading and info.
4.  **Retraining**: `retrain.py` performs automated retraining.

## Acceptance Guardrails

The inference path applies deterministic policy bounds for obvious high-risk
credit profiles while model recalibration is pending. This does not replace
training or formal model validation; it prevents combinations such as very low
credit score, unemployment, debt exceeding income, and excessive loan-to-income
ratio from being returned as low risk.

## Documentation

- [Data Mapping](docs/DATA_MAPPING.md)
