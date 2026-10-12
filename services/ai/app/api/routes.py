"""API routes."""
import logging

from fastapi import APIRouter, HTTPException

from app.models.model import ModelLoader, RiskAssessmentModel
from app.schemas.prediction import PredictionRequest, PredictionResponse, ExplanationModel, ShapValue
from app.services.explanation import ExplanationService
from app.services.shap_service import ShapService
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize model
try:
    ModelLoader.validate_artifacts()
    model = RiskAssessmentModel()
except FileNotFoundError as error:
    logger.critical("AI service cannot start: %s", error)
    raise RuntimeError(f"AI model startup validation failed: {error}") from error


@router.post("/predict-risk", response_model=PredictionResponse)
async def predict_risk(request: PredictionRequest) -> PredictionResponse:
    """
    Predict credit risk for a loan application.

    Args:
        request: Prediction request with applicant details

    Returns:
        Risk assessment prediction with explanation
    """
    try:
        if model is None:
            raise HTTPException(
                status_code=503,
                detail="Model not available. Please ensure the trained model is loaded.",
            )

        # Prepare features
        features = {
            "age": request.age,
            "annualIncome": request.annualIncome,
            "employmentType": request.employmentType.value,
            "existingDebt": request.existingDebt,
            "creditScore": request.creditScore,
            "loanAmount": request.loanAmount,
        }

        # Get prediction
        prediction_result = model.predict(features)

        # Categorize risk
        risk_category = ExplanationService.categorize_risk(
            prediction_result["approval_probability"]
        )

        # Generate SHAP explanation
        scaled_features = prediction_result["scaled_features"]
        shap_contributions = ShapService.explain_prediction(model.model, scaled_features)
        summary_text = ShapService.generate_human_explanation(shap_contributions)

        explanation_obj = ExplanationModel(
            summary=summary_text,
            shapValues=[ShapValue(feature=sc["feature"], value=sc["value"]) for sc in shap_contributions]
        )

        logger.info(
            f"Risk prediction completed: score={prediction_result['risk_score']}, "
            f"approval_prob={prediction_result['approval_probability']:.2f}, "
            f"category={risk_category}"
        )

        return PredictionResponse(
            riskScore=prediction_result["risk_score"],
            approvalProbability=prediction_result["approval_probability"],
            riskCategory=risk_category,
            modelVersion=settings.MODEL_VERSION,
            explanation=explanation_obj,
        )

    except Exception as e:
        logger.error(f"Error during prediction: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Prediction failed")
