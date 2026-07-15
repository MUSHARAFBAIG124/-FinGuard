"""Machine learning model wrapper."""
import logging
from pathlib import Path

import joblib
from sklearn.preprocessing import StandardScaler

from app.core.config import settings

logger = logging.getLogger(__name__)


class ModelLoader:
    """Load and cache ML models."""

    _model = None
    _scaler = None

    @classmethod
    def load_model(cls):
        """Load the trained model."""
        if cls._model is not None:
            return cls._model

        model_path = Path(settings.MODEL_DIR) / settings.MODEL_NAME
        if not model_path.exists():
            raise FileNotFoundError(f"Model not found at {model_path}")

        cls._model = joblib.load(model_path)
        logger.info(f"Model loaded from {model_path}")
        return cls._model

    @classmethod
    def load_scaler(cls):
        """Load the feature scaler."""
        if cls._scaler is not None:
            return cls._scaler

        scaler_path = Path(settings.MODEL_DIR) / settings.SCALER_NAME
        if not scaler_path.exists():
            raise FileNotFoundError(f"Scaler not found at {scaler_path}")

        cls._scaler = joblib.load(scaler_path)
        logger.info(f"Scaler loaded from {scaler_path}")
        return cls._scaler


class RiskAssessmentModel:
    """Risk assessment model interface."""

    def __init__(self):
        """Initialize model."""
        self.model = ModelLoader.load_model()
        self.scaler = ModelLoader.load_scaler()

    def predict(self, features: dict) -> dict:
        """
        Predict risk for given features.

        Args:
            features: Dictionary of feature values

        Returns:
            Dictionary with prediction results
        """
        # Transform features to match model training order
        feature_array = self._prepare_features(features)

        # Scale features
        scaled_features = self.scaler.transform([feature_array])

        # Get prediction and probability
        prediction = self.model.predict(scaled_features)[0]
        probabilities = self.model.predict_proba(scaled_features)[0]

        # Calculate approval probability (assuming class 1 is approved)
        raw_approval_prob = float(probabilities[1]) if len(probabilities) > 1 else 0.0
        approval_prob = self._apply_policy_bounds(features, raw_approval_prob)

        # Calculate risk score (0-100)
        risk_score = max(0, min(100, int((1 - approval_prob) * 100)))

        return {
            "approval_probability": approval_prob,
            "risk_score": risk_score,
            "prediction": int(prediction),
            "raw_approval_probability": raw_approval_prob,
            "scaled_features": scaled_features,
        }

    @staticmethod
    def _apply_policy_bounds(features: dict, approval_probability: float) -> float:
        """Constrain model output for obvious credit policy edge cases.

        This is an acceptance guardrail, not a replacement for retraining. It prevents
        known unsafe profile combinations from being classified as low risk while the
        underlying model is recalibrated.
        """
        annual_income = max(float(features["annualIncome"]), 0.0)
        existing_debt = max(float(features["existingDebt"]), 0.0)
        loan_amount = max(float(features["loanAmount"]), 0.0)
        credit_score = int(features["creditScore"])
        employment_type = features["employmentType"]

        debt_to_income = float("inf") if annual_income == 0 and existing_debt > 0 else (
            existing_debt / annual_income if annual_income > 0 else 0.0
        )
        loan_to_income = float("inf") if annual_income == 0 and loan_amount > 0 else (
            loan_amount / annual_income if annual_income > 0 else 0.0
        )

        high_risk_indicators = [
            credit_score < 580,
            debt_to_income > 0.8,
            loan_to_income > 2.5,
            employment_type == "UNEMPLOYED",
            annual_income == 0 and loan_amount > 0,
        ]
        high_risk_count = sum(1 for indicator in high_risk_indicators if indicator)

        if credit_score <= 350 and high_risk_count >= 3:
            return min(approval_probability, 0.25)
        if high_risk_count >= 3:
            return min(approval_probability, 0.35)
        if high_risk_count == 2:
            return min(approval_probability, 0.65)

        return approval_probability

    @staticmethod
    def _prepare_features(features: dict) -> list:
        """Prepare features in correct order for model."""
        # Feature order must match training pipeline
        employment_type_map = {
            "SALARIED": 0,
            "SELF_EMPLOYED": 1,
            "CONTRACT": 2,
            "UNEMPLOYED": 3,
            "RETIRED": 4,
        }

        return [
            features["age"],
            features["annualIncome"],
            employment_type_map.get(features["employmentType"], 0),
            features["existingDebt"],
            features["creditScore"],
            features["loanAmount"],
        ]
