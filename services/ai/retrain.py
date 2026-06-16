import joblib
import json
import os
from train import train, DATA_PATH

METADATA_PATH = "C:\\Users\\musha\\OneDrive\\Documents\\fintech\\services\\ai\\models\\metadata.json"

def get_next_version(current_version):
    major, minor, patch = map(int, current_version.split('.'))
    return f"{major}.{minor+1}.0"

def retrain():
    with open(METADATA_PATH, "r") as f:
        metadata = json.load(f)
    
    new_version = get_next_version(metadata["modelVersion"])
    print(f"Retraining model. New version: {new_version}")
    train(version=new_version)

if __name__ == "__main__":
    retrain()
