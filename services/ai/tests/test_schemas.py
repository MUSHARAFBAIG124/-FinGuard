"""Test schemas."""
import pytest

from app.schemas.prediction import PredictionRequest, PredictionResponse, EmploymentType, RiskCategory


class TestPredictionRequest:
    """Tests for prediction request schema."""

    def test_valid_request(self):
        """Test valid prediction request."""
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
        """Test age validation minimum."""
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
        """Test age validation maximum."""
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
        """Test credit score validation minimum."""
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
        """Test credit score validation maximum."""
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
        """Test negative income validation."""
        with pytest.raises(ValueError):
            PredictionRequest(
                age=35,
                annualIncome=-1000,
                employmentType=EmploymentType.SALARIED,
                existingDebt=10000,
                creditScore=720,
                loanAmount=30000,
            )


class TestPredictionResponse:
    """Tests for prediction response schema."""

    def test_valid_response(self):
        """Test valid prediction response."""
        response = PredictionResponse(
            riskScore=25,
            approvalProbability=0.85,
            riskCategory=RiskCategory.LOW,
            modelVersion="1.0.0",
            explanation="Low risk applicant",
        )
        assert response.riskScore == 25
        assert response.approvalProbability == 0.85
        assert response.riskCategory == RiskCategory.LOW

    def test_response_probability_boundaries(self):
        """Test probability field boundaries."""
        # Valid: 0.0
        response = PredictionResponse(
            riskScore=100,
            approvalProbability=0.0,
            riskCategory=RiskCategory.HIGH,
            modelVersion="1.0.0",
            explanation="High risk",
        )
        assert response.approvalProbability == 0.0

        # Valid: 1.0
        response = PredictionResponse(
            riskScore=0,
            approvalProbability=1.0,
            riskCategory=RiskCategory.LOW,
            modelVersion="1.0.0",
            explanation="Low risk",
        )
        assert response.approvalProbability == 1.0

        # Invalid: > 1.0
        with pytest.raises(ValueError):
            PredictionResponse(
                riskScore=0,
                approvalProbability=1.1,
                riskCategory=RiskCategory.LOW,
                modelVersion="1.0.0",
                explanation="Low risk",
            )
