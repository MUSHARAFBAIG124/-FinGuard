"""Integration tests for the predict-risk endpoint.

All tests target the production application (app.main) and the production
endpoint /api/v1/predict-risk with the current 6-feature payload schema.
Legacy ai_service imports and 24-feature payloads have been removed.
"""
import os
from pathlib import Path
import subprocess
import sys

import pytest
from fastapi.testclient import TestClient

os.environ["MODEL_DIR"] = str(Path(__file__).resolve().parents[1] / "models")

from app.main import app  # noqa: E402  (env must be set before import)

client = TestClient(app)

# ---------------------------------------------------------------------------
# Shared fixture payload
# ---------------------------------------------------------------------------

VALID_PAYLOAD = {
    "age": 35,
    "annualIncome": 65000,
    "employmentType": "SALARIED",
    "existingDebt": 5000,
    "creditScore": 720,
    "loanAmount": 25000,
}


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["modelLoaded"] is True


def test_service_startup_fails_clearly_when_model_artifacts_are_missing():
    env = {**os.environ, "MODEL_DIR": str(Path(__file__).parent / "missing-models")}
    result = subprocess.run(
        [sys.executable, "-c", "import app.main"],
        cwd=Path(__file__).resolve().parents[1],
        env=env,
        capture_output=True,
        text=True,
        check=False,
        timeout=10,
    )

    assert result.returncode != 0
    assert "AI model startup validation failed" in result.stderr
    assert "credit-risk-model.joblib" in result.stderr
    assert "feature-scaler.joblib" in result.stderr


# ---------------------------------------------------------------------------
# Prediction — success
# ---------------------------------------------------------------------------

def test_prediction_success():
    response = client.post("/api/v1/predict-risk", json=VALID_PAYLOAD)
    assert response.status_code == 200, response.text
    data = response.json()
    assert "approvalProbability" in data
    assert "riskScore" in data
    assert "riskCategory" in data
    assert "modelVersion" in data
    assert "explanation" in data


def test_prediction_explanation_is_structured():
    """explanation must be an ExplanationModel object, not a plain string."""
    response = client.post("/api/v1/predict-risk", json=VALID_PAYLOAD)
    assert response.status_code == 200, response.text
    explanation = response.json()["explanation"]
    assert isinstance(explanation, dict), "explanation must be a dict (ExplanationModel)"
    assert "summary" in explanation, "explanation must contain 'summary'"
    assert "shapValues" in explanation, "explanation must contain 'shapValues'"
    assert isinstance(explanation["shapValues"], list)


def test_prediction_shap_values_structure():
    """Each SHAP value must have 'feature' (str) and 'value' (float)."""
    response = client.post("/api/v1/predict-risk", json=VALID_PAYLOAD)
    assert response.status_code == 200, response.text
    shap_values = response.json()["explanation"]["shapValues"]
    assert len(shap_values) > 0
    for sv in shap_values:
        assert "feature" in sv and isinstance(sv["feature"], str)
        assert "value" in sv and isinstance(sv["value"], (int, float))


def test_prediction_probability_range():
    response = client.post("/api/v1/predict-risk", json=VALID_PAYLOAD)
    assert response.status_code == 200, response.text
    data = response.json()
    assert 0.0 <= data["approvalProbability"] <= 1.0
    assert 0 <= data["riskScore"] <= 100


def test_prediction_risk_category_enum():
    response = client.post("/api/v1/predict-risk", json=VALID_PAYLOAD)
    assert response.status_code == 200, response.text
    assert response.json()["riskCategory"] in {"LOW", "MEDIUM", "HIGH"}


# ---------------------------------------------------------------------------
# Prediction — validation errors (422)
# ---------------------------------------------------------------------------

def test_prediction_invalid_age():
    payload = {**VALID_PAYLOAD, "age": -1}
    response = client.post("/api/v1/predict-risk", json=payload)
    assert response.status_code == 422


def test_prediction_age_too_young():
    payload = {**VALID_PAYLOAD, "age": 17}
    response = client.post("/api/v1/predict-risk", json=payload)
    assert response.status_code == 422


def test_prediction_missing_fields():
    response = client.post("/api/v1/predict-risk", json={"age": 35})
    assert response.status_code == 422


def test_prediction_invalid_credit_score_low():
    payload = {**VALID_PAYLOAD, "creditScore": 200}
    response = client.post("/api/v1/predict-risk", json=payload)
    assert response.status_code == 422


def test_prediction_invalid_credit_score_high():
    payload = {**VALID_PAYLOAD, "creditScore": 900}
    response = client.post("/api/v1/predict-risk", json=payload)
    assert response.status_code == 422


def test_prediction_negative_income():
    payload = {**VALID_PAYLOAD, "annualIncome": -1}
    response = client.post("/api/v1/predict-risk", json=payload)
    assert response.status_code == 422


def test_prediction_negative_loan_amount():
    payload = {**VALID_PAYLOAD, "loanAmount": -1}
    response = client.post("/api/v1/predict-risk", json=payload)
    assert response.status_code == 422


def test_prediction_invalid_employment_type():
    payload = {**VALID_PAYLOAD, "employmentType": "FULL_TIME"}
    response = client.post("/api/v1/predict-risk", json=payload)
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Utility-level tests (no HTTP, stay in services/ai package)
# ---------------------------------------------------------------------------

def test_risk_mapping():
    from app.services.explanation import ExplanationService
    from app.schemas.prediction import RiskCategory
    assert ExplanationService.categorize_risk(0.9) == RiskCategory.LOW
    assert ExplanationService.categorize_risk(0.6) == RiskCategory.MEDIUM
    assert ExplanationService.categorize_risk(0.3) == RiskCategory.HIGH


def test_corrupted_model_loading():
    """joblib raises an exception on corrupted file."""
    import joblib, tempfile, os
    with tempfile.NamedTemporaryFile(suffix=".joblib", delete=False, mode="w") as f:
        f.write("corrupted")
        tmp_path = f.name
    try:
        with pytest.raises(Exception):
            joblib.load(tmp_path)
    finally:
        os.remove(tmp_path)
