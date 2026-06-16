"""Test explanation service."""
import pytest

from app.schemas.prediction import RiskCategory
from app.services.explanation import ExplanationService


class TestExplanationService:
    """Tests for explanation generation."""

    def test_generate_explanation_low_risk(self):
        """Test explanation for low risk profile."""
        features = {
            "age": 45,
            "annualIncome": 100000,
            "employmentType": "SALARIED",
            "existingDebt": 10000,
            "creditScore": 780,
            "loanAmount": 30000,
        }

        explanation = ExplanationService.generate_explanation(
            features, 15, RiskCategory.LOW, 0.85
        )

        assert "Low risk" in explanation
        assert "excellent credit score" in explanation
        assert isinstance(explanation, str)
        assert len(explanation) > 10

    def test_generate_explanation_medium_risk(self):
        """Test explanation for medium risk profile."""
        features = {
            "age": 35,
            "annualIncome": 60000,
            "employmentType": "SELF_EMPLOYED",
            "existingDebt": 20000,
            "creditScore": 680,
            "loanAmount": 40000,
        }

        explanation = ExplanationService.generate_explanation(
            features, 50, RiskCategory.MEDIUM, 0.55
        )

        assert "Medium risk" in explanation
        assert isinstance(explanation, str)

    def test_generate_explanation_high_risk(self):
        """Test explanation for high risk profile."""
        features = {
            "age": 25,
            "annualIncome": 30000,
            "employmentType": "UNEMPLOYED",
            "existingDebt": 50000,
            "creditScore": 550,
            "loanAmount": 50000,
        }

        explanation = ExplanationService.generate_explanation(
            features, 85, RiskCategory.HIGH, 0.25
        )

        assert "High risk" in explanation
        assert isinstance(explanation, str)

    def test_categorize_risk_low(self):
        """Test risk categorization for low approval probability."""
        category = ExplanationService.categorize_risk(0.85)
        assert category == RiskCategory.LOW

    def test_categorize_risk_medium(self):
        """Test risk categorization for medium approval probability."""
        category = ExplanationService.categorize_risk(0.55)
        assert category == RiskCategory.MEDIUM

    def test_categorize_risk_high(self):
        """Test risk categorization for high approval probability."""
        category = ExplanationService.categorize_risk(0.25)
        assert category == RiskCategory.HIGH

    def test_categorize_risk_boundary_low_medium(self):
        """Test boundary between low and medium risk."""
        category_low = ExplanationService.categorize_risk(0.7)
        category_medium = ExplanationService.categorize_risk(0.69)
        assert category_low == RiskCategory.LOW
        assert category_medium == RiskCategory.MEDIUM

    def test_categorize_risk_boundary_medium_high(self):
        """Test boundary between medium and high risk."""
        category_medium = ExplanationService.categorize_risk(0.4)
        category_high = ExplanationService.categorize_risk(0.39)
        assert category_medium == RiskCategory.MEDIUM
        assert category_high == RiskCategory.HIGH

    def test_explanation_includes_factors(self):
        """Test that explanation includes relevant factors."""
        features = {
            "age": 40,
            "annualIncome": 80000,
            "employmentType": "SALARIED",
            "existingDebt": 5000,
            "creditScore": 700,
            "loanAmount": 25000,
        }

        explanation = ExplanationService.generate_explanation(
            features, 30, RiskCategory.LOW, 0.75
        )

        # Should mention credit score, debt, and income factors
        assert any(
            term in explanation.lower()
            for term in ["credit", "debt", "income", "employment"]
        )
