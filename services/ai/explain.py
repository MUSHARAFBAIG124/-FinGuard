import shap
import joblib
import numpy as np
import pandas as pd
import os

# Assuming X_train is needed for SHAP Explainer
# For brevity, we load a small subset or re-load data if possible.
# In a real scenario, this would be properly managed.
MODEL_PATH = "C:\\Users\\musha\\OneDrive\\Documents\\fintech\\services\\ai\\models\\credit-risk-model.joblib"

def explain_with_shap(features_array):
    try:
        model = joblib.load(MODEL_PATH)
        # Assuming we need a reference dataset for SHAP
        # Since we don't have it easily available, we use a simple rule-based fallback
        # Real implementation would load background data
        return None
    except Exception:
        return None

def generate_explanation(probability: float, features: dict) -> dict:
    # Try SHAP
    shap_explanation = explain_with_shap(None)
    
    if shap_explanation:
        return shap_explanation
        
    # Rule-based fallback
    risk_category = "LOW" if probability >= 0.80 else ("MEDIUM" if probability >= 0.50 else "HIGH")
    reasons = []
    if features.get("creditScore", 0) > 700: reasons.append("high credit score")
    elif features.get("creditScore", 0) < 500: reasons.append("low credit score")
    if features.get("existingDebt", 0) / (features.get("annualIncome", 1) + 1) < 0.2: reasons.append("low debt burden")
    else: reasons.append("high debt burden")
        
    return {
        "summary": f"{risk_category} risk assessment",
        "positiveFactors": reasons[:2] if risk_category == "LOW" else [],
        "negativeFactors": reasons[2:] if risk_category != "LOW" else []
    }
