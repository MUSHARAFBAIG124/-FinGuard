"""Model training pipeline."""
import logging
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import joblib

logger = logging.getLogger(__name__)


class TrainingPipeline:
    """ML model training and evaluation pipeline."""

    def __init__(self, model_dir: str = "services/ai/models"):
        """Initialize pipeline."""
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)

    def prepare_features(self, df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        """
        Prepare features and target.

        Args:
            df: DataFrame with features and target

        Returns:
            Tuple of (features, target)
        """
        feature_cols = ["age", "annualIncome", "employmentType", "existingDebt", "creditScore", "loanAmount"]
        X = df[feature_cols].values
        y = df["loanApproved"].values
        return X, y

    def train_random_forest(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_test: np.ndarray,
        y_test: np.ndarray,
    ) -> dict:
        """
        Train Random Forest model.

        Args:
            X_train: Training features
            y_train: Training target
            X_test: Test features
            y_test: Test target

        Returns:
            Dictionary with model and metrics
        """
        logger.info("Training Random Forest Classifier...")

        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=15,
            min_samples_split=10,
            min_samples_leaf=5,
            random_state=42,
            n_jobs=-1,
        )

        model.fit(X_train, y_train)

        # Evaluate
        y_pred = model.predict(X_test)
        metrics = {
            "model": model,
            "accuracy": accuracy_score(y_test, y_pred),
            "precision": precision_score(y_test, y_pred),
            "recall": recall_score(y_test, y_pred),
            "f1": f1_score(y_test, y_pred),
        }

        logger.info(f"Random Forest metrics: {metrics}")
        return metrics

    def train_logistic_regression(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_test: np.ndarray,
        y_test: np.ndarray,
        scaler: StandardScaler,
    ) -> dict:
        """
        Train Logistic Regression model.

        Args:
            X_train: Training features
            y_train: Training target
            X_test: Test features
            y_test: Test target
            scaler: Feature scaler

        Returns:
            Dictionary with model and metrics
        """
        logger.info("Training Logistic Regression...")

        # Scale features for logistic regression
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)

        model = LogisticRegression(max_iter=1000, random_state=42)
        model.fit(X_train_scaled, y_train)

        # Evaluate
        y_pred = model.predict(X_test_scaled)
        metrics = {
            "model": model,
            "accuracy": accuracy_score(y_test, y_pred),
            "precision": precision_score(y_test, y_pred),
            "recall": recall_score(y_test, y_pred),
            "f1": f1_score(y_test, y_pred),
        }

        logger.info(f"Logistic Regression metrics: {metrics}")
        return metrics

    def train(self, df: pd.DataFrame) -> dict:
        """
        Train and evaluate models.

        Args:
            df: Training dataset

        Returns:
            Dictionary with best model and results
        """
        logger.info(f"Starting training pipeline with {len(df)} samples")

        # Prepare features
        X, y = self.prepare_features(df)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )

        logger.info(f"Training set: {len(X_train)}, Test set: {len(X_test)}")

        # Initialize scaler
        scaler = StandardScaler()

        # Train Random Forest
        rf_metrics = self.train_random_forest(X_train, y_train, X_test, y_test)

        # Train Logistic Regression
        lr_metrics = self.train_logistic_regression(X_train, y_train, X_test, y_test, scaler)

        # Select best model based on F1 score
        best_model = (
            rf_metrics["model"]
            if rf_metrics["f1"] >= lr_metrics["f1"]
            else lr_metrics["model"]
        )
        best_name = (
            "Random Forest" if rf_metrics["f1"] >= lr_metrics["f1"] else "Logistic Regression"
        )

        logger.info(f"Best model: {best_name} (F1: {max(rf_metrics['f1'], lr_metrics['f1']):.4f})")

        # Save best model
        model_path = self.model_dir / "credit-risk-model.joblib"
        joblib.dump(best_model, model_path)
        logger.info(f"Model saved to {model_path}")

        # Save scaler
        scaler_path = self.model_dir / "feature-scaler.joblib"
        joblib.dump(scaler, scaler_path)
        logger.info(f"Scaler saved to {scaler_path}")

        return {
            "best_model": best_model,
            "best_model_name": best_name,
            "random_forest": rf_metrics,
            "logistic_regression": lr_metrics,
            "model_path": str(model_path),
            "scaler_path": str(scaler_path),
        }
