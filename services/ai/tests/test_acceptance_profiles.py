"""Acceptance tests for policy-level risk profile behavior.

These tests document expected production guardrails. They do not retrain or
validate model accuracy; they ensure obviously risky profiles cannot be returned
as low risk while model recalibration is pending.
"""

import os
from pathlib import Path

from fastapi.testclient import TestClient

os.environ["MODEL_DIR"] = str(Path(__file__).resolve().parents[1] / "models")

from app.main import app


client = TestClient(app)


def predict(payload: dict) -> dict:
    response = client.post("/api/v1/predict-risk", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def test_very_safe_profile_is_low_risk():
    data = predict(
        {
            "age": 42,
            "annualIncome": 180000,
            "employmentType": "SALARIED",
            "existingDebt": 5000,
            "creditScore": 820,
            "loanAmount": 25000,
        }
    )

    assert data["riskCategory"] == "LOW"
    assert data["approvalProbability"] >= 0.7
    assert data["riskScore"] <= 30


def test_moderate_profile_is_not_low_risk():
    data = predict(
        {
            "age": 36,
            "annualIncome": 60000,
            "employmentType": "SALARIED",
            "existingDebt": 54000,
            "creditScore": 560,
            "loanAmount": 40000,
        }
    )

    assert data["riskCategory"] in {"MEDIUM", "HIGH"}
    assert data["approvalProbability"] < 0.7
    assert data["riskScore"] >= 35


def test_high_risk_profile_is_high_risk():
    data = predict(
        {
            "age": 24,
            "annualIncome": 18000,
            "employmentType": "UNEMPLOYED",
            "existingDebt": 45000,
            "creditScore": 320,
            "loanAmount": 90000,
        }
    )

    assert data["riskCategory"] == "HIGH"
    assert data["approvalProbability"] < 0.4
    assert data["riskScore"] >= 60


def test_extreme_profile_is_high_risk():
    data = predict(
        {
            "age": 100,
            "annualIncome": 0,
            "employmentType": "UNEMPLOYED",
            "existingDebt": 1000000000,
            "creditScore": 300,
            "loanAmount": 999999999,
        }
    )

    assert data["riskCategory"] == "HIGH"
    assert data["approvalProbability"] <= 0.25
    assert data["riskScore"] >= 75
