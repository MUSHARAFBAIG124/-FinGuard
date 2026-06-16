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
        approval_prob = float(probabilities[1]) if len(probabilities) > 1 else 0.0

        # Calculate risk score (0-100)
        risk_score = max(0, min(100, int((1 - approval_prob) * 100)))

        return {
            "approval_probability": approval_prob,
            "risk_score": risk_score,
            "prediction": int(prediction),
        }

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
