"""Risk explanation generation service."""
from app.schemas.prediction import RiskCategory


class ExplanationService:
    """Generate human-readable risk explanations."""

    @staticmethod
    def generate_explanation(
        features: dict,
        risk_score: int,
        risk_category: RiskCategory,
        approval_probability: float,
    ) -> str:
        """
        Generate deterministic explanation based on model inputs.

        Args:
            features: Dictionary of feature values
            risk_score: Calculated risk score (0-100)
            risk_category: Risk category (LOW/MEDIUM/HIGH)
            approval_probability: Probability of approval

        Returns:
            Human-readable explanation
        """
        factors = []

        # Analyze credit score
        credit_score = features["creditScore"]
        if credit_score >= 750:
            factors.append("excellent credit score")
        elif credit_score >= 700:
            factors.append("good credit score")
        elif credit_score >= 650:
            factors.append("fair credit score")
        else:
            factors.append("low credit score")

        # Analyze debt-to-income ratio
        debt_to_income = (
            features["existingDebt"] / features["annualIncome"]
            if features["annualIncome"] > 0
            else 1.0
        )
        if debt_to_income < 0.3:
            factors.append("low debt-to-income ratio")
        elif debt_to_income < 0.5:
            factors.append("moderate debt-to-income ratio")
        else:
            factors.append("high debt-to-income ratio")

        # Analyze loan-to-income ratio
        loan_to_income = (
            features["loanAmount"] / features["annualIncome"]
            if features["annualIncome"] > 0
            else 1.0
        )
        if loan_to_income < 1.0:
            factors.append("loan amount reasonable relative to income")
        elif loan_to_income < 2.0:
            factors.append("loan amount moderately high relative to income")
        else:
            factors.append("loan amount very high relative to income")

        # Analyze income stability
        employment_type = features["employmentType"]
        if employment_type == "SALARIED":
            factors.append("stable employment (salaried)")
        elif employment_type == "SELF_EMPLOYED":
            factors.append("self-employed (variable income)")
        elif employment_type == "CONTRACT":
            factors.append("contract-based employment (less stable)")
        elif employment_type == "RETIRED":
            factors.append("retired status")
        else:
            factors.append("unemployed status")

        # Analyze age
        age = features["age"]
        if age >= 30 and age <= 60:
            factors.append("prime working years")
        elif age < 30:
            factors.append("relatively young")
        else:
            factors.append("near retirement age")

        # Build explanation based on risk category
        if risk_category == RiskCategory.LOW:
            positive_factors = factors[:3]
            explanation = (
                f"Low risk because applicant has {', '.join(positive_factors)}."
            )
        elif risk_category == RiskCategory.MEDIUM:
            explanation = f"Medium risk due to mixed profile: {', '.join(factors)}."
        else:  # HIGH
            negative_factors = [f for f in factors if "low" not in f.lower()]
            explanation = f"High risk due to: {', '.join(negative_factors or factors)}."

        # Add probability context
        if approval_probability >= 0.8:
            explanation += " However, overall approval probability is strong."
        elif approval_probability >= 0.6:
            explanation += " Approval probability is moderate."
        else:
            explanation += " Approval probability is low."

        return explanation

    @staticmethod
    def categorize_risk(approval_probability: float) -> RiskCategory:
        """
        Categorize risk based on approval probability.

        Args:
            approval_probability: Probability of approval (0-1)

        Returns:
            Risk category
        """
        if approval_probability >= 0.7:
            return RiskCategory.LOW
        elif approval_probability >= 0.4:
            return RiskCategory.MEDIUM
        else:
            return RiskCategory.HIGH
