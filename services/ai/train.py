import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
import joblib
import json
import os

DATA_PATH = os.path.join(os.path.dirname(__file__), "Dataset", "german.data-numeric")
MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH = os.path.join(MODELS_DIR, "credit-risk-model.joblib")
SCALER_PATH = os.path.join(MODELS_DIR, "feature-scaler.joblib")
METADATA_PATH = os.path.join(MODELS_DIR, "metadata.json")

def load_data():
    df = pd.read_csv(DATA_PATH, sep=r'\s+', header=None, engine='python')
    
    # Target: last column, mapped (1: good/approved -> 1, 2: bad/rejected -> 0)
    y = df.iloc[:, -1].map({1: 1, 2: 0})
    
    # Use exact 6 features for inference schema: 
    # age, annualIncome, employmentType, existingDebt, creditScore, loanAmount
    X = df.iloc[:, :6]
    feature_names = ["age", "annualIncome", "employmentType", "existingDebt", "creditScore", "loanAmount"]
    
    return X, y, feature_names

def train(version="1.1.0"):
    X, y, feature_names = load_data()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Fit StandardScaler
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train Random Forest
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train_scaled, y_train)
    
    # Metrics
    y_pred_train = model.predict(X_train_scaled)
    y_pred_test = model.predict(X_test_scaled)
    y_prob_test = model.predict_proba(X_test_scaled)[:, 1]
    
    train_acc = accuracy_score(y_train, y_pred_train)
    test_acc = accuracy_score(y_test, y_pred_test)
    prec = precision_score(y_test, y_pred_test)
    rec = recall_score(y_test, y_pred_test)
    f1 = f1_score(y_test, y_pred_test)
    roc = roc_auc_score(y_test, y_prob_test)
    
    # Feature importance
    importances = model.feature_importances_
    top_features = [{"name": name, "importance": float(imp)} for name, imp in zip(feature_names, importances)]
    top_features = sorted(top_features, key=lambda x: x["importance"], reverse=True)
    
    metadata = {
        "modelVersion": version,
        "algorithm": "RandomForest",
        "trainingAccuracy": train_acc,
        "accuracy": test_acc,
        "precision": prec,
        "recall": rec,
        "f1": f1,
        "rocAuc": roc,
        "topFeatures": top_features,
        "n_features": model.n_features_in_
    }
    
    # Save artifacts
    os.makedirs(MODELS_DIR, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=4)
        
    print(f"--- Training Complete ---")
    print(f"Training feature list: {feature_names}")
    print(f"Model feature count: {model.n_features_in_}")
    print(f"Scaler feature count: {scaler.n_features_in_}")
    print(f"Training accuracy: {train_acc:.3f}")
    print(f"Validation accuracy: {test_acc:.3f}")
    print(f"Model saved to: {MODEL_PATH}")
    print(f"Scaler saved to: {SCALER_PATH}")

if __name__ == "__main__":
    train()
