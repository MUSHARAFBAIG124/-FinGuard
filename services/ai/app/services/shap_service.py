"""SHAP Explainer Service."""
import logging
import shap
import numpy as np

logger = logging.getLogger(__name__)

class ShapService:
    """Generate SHAP feature contributions using TreeExplainer."""

    _explainer = None
    _feature_names = [
        "age",
        "annualIncome",
        "employmentType",
        "existingDebt",
        "creditScore",
        "loanAmount"
    ]

    @classmethod
    def initialize_explainer(cls, model):
        """Initialize and cache the SHAP TreeExplainer."""
        if cls._explainer is None and model is not None:
            # For RandomForestClassifier, shap.TreeExplainer is highly optimized.
            # model is expected to be a RandomForestClassifier loaded from joblib
            cls._explainer = shap.TreeExplainer(model)
            logger.info("SHAP TreeExplainer initialized successfully.")

    @classmethod
    def explain_prediction(cls, model, scaled_features: np.ndarray) -> list:
        """
        Calculate SHAP values for the given scaled feature vector.

        Args:
            model: The loaded RandomForestClassifier
            scaled_features: 2D numpy array containing the scaled features

        Returns:
            List of dictionaries containing feature contributions.
        """
        cls.initialize_explainer(model)
        
        if cls._explainer is None:
            logger.warning("SHAP explainer could not be initialized.")
            return []

        # Calculate SHAP values
        shap_values = cls._explainer.shap_values(scaled_features)
        
        # For RandomForestClassifier (binary), shap_values is typically a list of arrays for each class.
        # We want the explanation for the positive class (class 1, index 1)
        if isinstance(shap_values, list):
            contributions = shap_values[1][0]
        else:
            if len(shap_values.shape) == 3:
                # Shape: (1, 6, 2) -> we want index 0 (sample 0) and column 1 (class 1)
                contributions = shap_values[0][:, 1]
            else:
                contributions = shap_values[0]

        # Map contributions to exact feature names
        feature_contributions = []
        for name, value in zip(cls._feature_names, contributions):
            feature_contributions.append({
                "feature": name,
                "value": float(value)
            })

        return feature_contributions

    @classmethod
    def generate_human_explanation(cls, shap_contributions: list) -> str:
        """
        Generate human-readable explanation from SHAP values.
        Rules:
        * sort by absolute contribution
        * take top 3 contributors
        """
        if not shap_contributions:
            return "Explanation not available."

        # Sort by absolute value to find most impactful features
        sorted_contributions = sorted(
            shap_contributions, 
            key=lambda x: abs(x["value"]), 
            reverse=True
        )

        top_3 = sorted_contributions[:3]

        # Format explanation lines
        reasons = []
        for i, item in enumerate(top_3, 1):
            feature = item["feature"]
            val = item["value"]
            
            # Map camelCase to readable words
            readable_map = {
                "age": "age",
                "annualIncome": "annual income",
                "employmentType": "employment type",
                "existingDebt": "existing debt",
                "creditScore": "credit score",
                "loanAmount": "loan amount"
            }
            readable_name = readable_map.get(feature, feature)
            
            # Direction
            if val > 0:
                reasons.append(f"{i}. Favorable {readable_name}")
            else:
                reasons.append(f"{i}. Unfavorable {readable_name}")

        explanation = f"Loan decision primarily influenced by:\n" + "\n".join(reasons)
        return explanation
