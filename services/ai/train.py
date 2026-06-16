import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
import joblib
import json
import os

DATA_PATH = "C:\\Users\\musha\\OneDrive\\Documents\\fintech\\services\\ai\\Dataset\\german.data-numeric"
MODELS_DIR = "C:\\Users\\musha\\OneDrive\\Documents\\fintech\\services\\ai\\models"
MODEL_PATH = os.path.join(MODELS_DIR, "credit-risk-model.joblib")
METADATA_PATH = os.path.join(MODELS_DIR, "metadata.json")

def load_data():
    df = pd.read_csv(DATA_PATH, sep='\s+', header=None)
    X = df.iloc[:, :-1]
    y = df.iloc[:, -1].map({1: 1, 2: 0})
    return X, y

def train(version="1.0.0"):
    X, y = load_data()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Selected Random Forest based on performance
    model = RandomForestClassifier(random_state=42)
    model.fit(X_train, y_train)
    
    y_pred = model.predict(X_test)
    y_prob = model.predict_proba(X_test)[:, 1]
    
    # Feature importance
    importances = model.feature_importances_
    feature_names = [f"f{i+1}" for i in range(X.shape[1])]
    top_features = [{"name": name, "importance": float(imp)} for name, imp in zip(feature_names, importances)]
    top_features = sorted(top_features, key=lambda x: x["importance"], reverse=True)[:5]
    
    metadata = {
        "modelVersion": version,
        "algorithm": "RandomForest",
        "accuracy": accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred),
        "recall": recall_score(y_test, y_pred),
        "f1": f1_score(y_test, y_pred),
        "rocAuc": roc_auc_score(y_test, y_prob),
        "topFeatures": top_features
    }
    
    joblib.dump(model, MODEL_PATH)
    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=4)
        
    print(f"Model {version} trained and saved.")

if __name__ == "__main__":
    train()
