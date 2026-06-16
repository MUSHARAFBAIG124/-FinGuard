"""API routes."""
import logging

from fastapi import APIRouter, HTTPException

from app.models.model import RiskAssessmentModel
from app.schemas.prediction import PredictionRequest, PredictionResponse
from app.services.explanation import ExplanationService
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize model
try:
    model = RiskAssessmentModel()
except FileNotFoundError as e:
    logger.warning(f"Model not found: {e}. Running in demo mode.")
    model = None


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

        # Generate explanation
        explanation = ExplanationService.generate_explanation(
            features,
            prediction_result["risk_score"],
            risk_category,
            prediction_result["approval_probability"],
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
            explanation=explanation,
        )

    except Exception as e:
        logger.error(f"Error during prediction: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Prediction failed")
