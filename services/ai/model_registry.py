import joblib
import json
import os

BASE_DIR = "C:\\Users\\musha\\OneDrive\\Documents\\fintech\\services\\ai"
MODELS_DIR = os.path.join(BASE_DIR, "models")
MODEL_PATH = os.path.join(MODELS_DIR, "credit-risk-model.joblib")
METADATA_PATH = os.path.join(MODELS_DIR, "metadata.json")

def load_model():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model file not found at {MODEL_PATH}")
    return joblib.load(MODEL_PATH)

def load_metadata():
    if not os.path.exists(METADATA_PATH):
        raise FileNotFoundError(f"Metadata file not found at {METADATA_PATH}")
    with open(METADATA_PATH, "r") as f:
        return json.load(f)

def get_active_model_info():
    metadata = load_metadata()
    return metadata
