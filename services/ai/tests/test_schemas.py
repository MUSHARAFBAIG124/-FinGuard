"""Tests for prediction request/response schemas.

PredictionResponse.explanation is now an ExplanationModel (structured object),
not a plain string. All fixtures have been updated accordingly.
"""
import pytest

from app.schemas.prediction import (
    PredictionRequest,
    PredictionResponse,
    ExplanationModel,
    ShapValue,
    EmploymentType,
    RiskCategory,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_explanation(**kwargs) -> ExplanationModel:
    """Return a minimal valid ExplanationModel for use in response fixtures."""
    defaults = dict(
        summary="Low risk applicant with strong credit profile.",
        shapValues=[
            ShapValue(feature="creditScore", value=0.35),
            ShapValue(feature="existingDebt", value=-0.12),
        ],
    )
    defaults.update(kwargs)
    return ExplanationModel(**defaults)


# ---------------------------------------------------------------------------
# PredictionRequest
# ---------------------------------------------------------------------------

class TestPredictionRequest:
    """Tests for prediction request schema."""

    def test_valid_request(self):
        request = PredictionRequest(
            age=35,
            annualIncome=75000,
            employmentType=EmploymentType.SALARIED,
            existingDebt=10000,
            creditScore=720,
            loanAmount=30000,
        )
        assert request.age == 35
        assert request.creditScore == 720

    def test_age_validation_min(self):
        with pytest.raises(ValueError):
            PredictionRequest(
                age=17,
                annualIncome=75000,
                employmentType=EmploymentType.SALARIED,
                existingDebt=10000,
                creditScore=720,
                loanAmount=30000,
            )

    def test_age_validation_max(self):
        with pytest.raises(ValueError):
            PredictionRequest(
                age=101,
                annualIncome=75000,
                employmentType=EmploymentType.SALARIED,
                existingDebt=10000,
                creditScore=720,
                loanAmount=30000,
            )

    def test_credit_score_validation_min(self):
        with pytest.raises(ValueError):
            PredictionRequest(
                age=35,
                annualIncome=75000,
                employmentType=EmploymentType.SALARIED,
                existingDebt=10000,
                creditScore=299,
                loanAmount=30000,
            )

    def test_credit_score_validation_max(self):
        with pytest.raises(ValueError):
            PredictionRequest(
                age=35,
                annualIncome=75000,
                employmentType=EmploymentType.SALARIED,
                existingDebt=10000,
                creditScore=851,
                loanAmount=30000,
            )

    def test_negative_income_validation(self):
        with pytest.raises(ValueError):
            PredictionRequest(
                age=35,
                annualIncome=-1000,
                employmentType=EmploymentType.SALARIED,
                existingDebt=10000,
                creditScore=720,
                loanAmount=30000,
            )


# ---------------------------------------------------------------------------
# ExplanationModel
# ---------------------------------------------------------------------------

class TestExplanationModel:
    """Tests for the structured ExplanationModel schema."""

    def test_valid_explanation_model(self):
        exp = make_explanation()
        assert isinstance(exp.summary, str)
        assert len(exp.shapValues) > 0

    def test_shap_value_fields(self):
        sv = ShapValue(feature="creditScore", value=0.42)
        assert sv.feature == "creditScore"
        assert sv.value == pytest.approx(0.42)

    def test_shap_value_negative(self):
        sv = ShapValue(feature="existingDebt", value=-0.25)
        assert sv.value < 0

    def test_explanation_empty_shap_list_allowed(self):
        """Empty shapValues list is structurally valid."""
        exp = ExplanationModel(summary="No SHAP data available.", shapValues=[])
        assert exp.shapValues == []


# ---------------------------------------------------------------------------
# PredictionResponse
# ---------------------------------------------------------------------------

class TestPredictionResponse:
    """Tests for prediction response schema."""

    def test_valid_response(self):
        response = PredictionResponse(
            riskScore=25,
            approvalProbability=0.85,
            riskCategory=RiskCategory.LOW,
            modelVersion="1.1.0",
            explanation=make_explanation(),
        )
        assert response.riskScore == 25
        assert response.approvalProbability == 0.85
        assert response.riskCategory == RiskCategory.LOW
        assert isinstance(response.explanation, ExplanationModel)

    def test_response_probability_boundary_zero(self):
        response = PredictionResponse(
            riskScore=100,
            approvalProbability=0.0,
            riskCategory=RiskCategory.HIGH,
            modelVersion="1.1.0",
            explanation=make_explanation(summary="High risk."),
        )
        assert response.approvalProbability == 0.0

    def test_response_probability_boundary_one(self):
        response = PredictionResponse(
            riskScore=0,
            approvalProbability=1.0,
            riskCategory=RiskCategory.LOW,
            modelVersion="1.1.0",
            explanation=make_explanation(summary="Low risk."),
        )
        assert response.approvalProbability == 1.0

    def test_response_probability_above_one_invalid(self):
        with pytest.raises(ValueError):
            PredictionResponse(
                riskScore=0,
                approvalProbability=1.1,
                riskCategory=RiskCategory.LOW,
                modelVersion="1.1.0",
                explanation=make_explanation(),
            )

    def test_response_probability_below_zero_invalid(self):
        with pytest.raises(ValueError):
            PredictionResponse(
                riskScore=100,
                approvalProbability=-0.1,
                riskCategory=RiskCategory.HIGH,
                modelVersion="1.1.0",
                explanation=make_explanation(summary="High risk."),
            )

    def test_response_explanation_rejects_plain_string(self):
        """explanation field must not accept a plain string."""
        with pytest.raises((ValueError, TypeError)):
            PredictionResponse(
                riskScore=25,
                approvalProbability=0.85,
                riskCategory=RiskCategory.LOW,
                modelVersion="1.1.0",
                explanation="plain string",  # type: ignore[arg-type]
            )
