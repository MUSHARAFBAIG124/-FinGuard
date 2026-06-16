# AI Architecture

The service follows a clean architecture for ML:

1.  **Data Ingestion**: Dataset from `datasets/`.
2.  **Training**: `train.py` (RandomForest) -> `models/`.
3.  **Inference**: `ai_service.py` (FastAPI) loads model via `model_registry.py`.
4.  **Explainability**: `explain.py` (Rule-based / SHAP).
5.  **Governance**: `models/metadata.json` stores metrics, importance, version.
