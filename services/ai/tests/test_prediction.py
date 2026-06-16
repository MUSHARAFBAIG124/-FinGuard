import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from fastapi.testclient import TestClient
from ai_service import app
import json

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_model_info_endpoint():
    response = client.get("/model-info")
    assert response.status_code == 200
    assert "modelVersion" in response.json()

def test_prediction_success():
    payload = {
        "age": 35,
        "annualIncome": 65000,
        "employmentType": "FULL_TIME",
        "existingDebt": 5000,
        "creditScore": 720,
        "loanAmount": 25000
    }
    response = client.post("/predict-risk", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "approvalProbability" in data
    assert "explanation" in data
    assert "risk" in data["explanation"].lower()

def test_prediction_validation():
    # Invalid age
    payload = {"age": -1, "annualIncome": 65000, "employmentType": "FULL_TIME", "existingDebt": 5000, "creditScore": 720, "loanAmount": 25000}
    response = client.post("/predict-risk", json=payload)
    assert response.status_code == 422

def test_missing_fields():
    payload = {"age": 35}
    response = client.post("/predict-risk", json=payload)
    assert response.status_code == 422

def test_invalid_credit_score():
    payload = {"age": 35, "annualIncome": 65000, "employmentType": "FULL_TIME", "existingDebt": 5000, "creditScore": 200, "loanAmount": 25000}
    response = client.post("/predict-risk", json=payload)
    assert response.status_code == 422

def test_explanation_generation():
    from explain import generate_explanation
    features = {"creditScore": 400, "existingDebt": 50000, "annualIncome": 20000, "loanAmount": 100000}
    explanation = generate_explanation(0.3, features)
    assert "HIGH" in explanation["summary"]

def test_risk_mapping():
    from risk_mapper import map_probability_to_category
    assert map_probability_to_category(0.9) == "LOW"
    assert map_probability_to_category(0.6) == "MEDIUM"
    assert map_probability_to_category(0.3) == "HIGH"

def test_metadata_loading_failure():
    # Simulate missing metadata file
    import model_registry
    original_path = model_registry.METADATA_PATH
    model_registry.METADATA_PATH = "non_existent.json"
    
    with pytest.raises(FileNotFoundError):
        model_registry.load_metadata()
        
    model_registry.METADATA_PATH = original_path

def test_corrupted_model_loading():
    # Simulate corrupted model
    with open("corrupted.joblib", "w") as f:
        f.write("corrupted")
    
    with pytest.raises(Exception):
        import joblib
        joblib.load("corrupted.joblib")
    
    import os
    os.remove("corrupted.joblib")
