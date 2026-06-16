import time
from fastapi import FastAPI, HTTPException
import joblib
import json
import numpy as np
import os
from risk_mapper import map_probability_to_category, calculate_risk_score
from explain import generate_explanation
from feature_mapper import LoanApplication, map_to_features
from metrics_service import update_metrics, get_metrics

app = FastAPI()

MODEL_PATH = "C:\\Users\\musha\\OneDrive\\Documents\\fintech\\services\\ai\\models\\credit-risk-model.joblib"
METADATA_PATH = "C:\\Users\\musha\\OneDrive\\Documents\\fintech\\services\\ai\\models\\metadata.json"

# Load model and metadata
model = joblib.load(MODEL_PATH)
with open(METADATA_PATH, "r") as f:
    metadata = json.load(f)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "modelLoaded": True,
        "modelVersion": metadata["modelVersion"]
    }

@app.get("/model-info")
async def model_info():
    metrics = await get_metrics()
    return {
        **metadata,
        "metrics": metrics
    }

@app.get("/model-metrics")
async def get_model_metrics():
    metrics = await get_metrics()
    if not metrics:
        return {"error": "No metrics found"}
    
    return {
        "modelVersion": metadata["modelVersion"],
        **metrics
    }

@app.post("/predict-risk")
async def predict_risk(request: LoanApplication):
    start_time = time.time()
    try:
        features = np.array([map_to_features(request)])
        
        probability = model.predict_proba(features)[0][1]
        
        category = map_probability_to_category(probability)
        score = calculate_risk_score(probability)
        explanation_dict = generate_explanation(probability, request.model_dump())
        
        latency = (time.time() - start_time) * 1000
        await update_metrics(latency, True)
        
        return {
            "approvalProbability": float(probability),
            "riskScore": score,
            "riskCategory": category,
            "modelVersion": metadata["modelVersion"],
            "riskEngineVersion": metadata["modelVersion"],
            "explanation": explanation_dict
        }
    except Exception as e:
        latency = (time.time() - start_time) * 1000
        await update_metrics(latency, False)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
