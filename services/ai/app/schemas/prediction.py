"""API request and response schemas."""
from enum import Enum

from pydantic import BaseModel, Field


class EmploymentType(str, Enum):
    """Employment type enum."""

    SALARIED = "SALARIED"
    SELF_EMPLOYED = "SELF_EMPLOYED"
    CONTRACT = "CONTRACT"
    UNEMPLOYED = "UNEMPLOYED"
    RETIRED = "RETIRED"


class RiskCategory(str, Enum):
    """Risk category enum."""

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class PredictionRequest(BaseModel):
    """Request model for risk prediction."""

    age: int = Field(..., ge=18, le=100, description="Applicant age")
    annualIncome: float = Field(..., ge=0, description="Annual income")
    employmentType: EmploymentType = Field(..., description="Employment type")
    existingDebt: float = Field(..., ge=0, description="Existing debt")
    creditScore: int = Field(..., ge=300, le=850, description="Credit score")
    loanAmount: float = Field(..., ge=0, description="Loan amount requested")


class ShapValue(BaseModel):
    feature: str
    value: float


class ExplanationModel(BaseModel):
    summary: str = Field(..., description="Risk explanation summary")
    shapValues: list[ShapValue] = Field(..., description="SHAP feature contributions")


class PredictionResponse(BaseModel):
    """Response model for risk prediction."""

    riskScore: int = Field(..., ge=0, le=100, description="Risk score (0-100)")
    approvalProbability: float = Field(
        ..., ge=0, le=1, description="Probability of approval"
    )
    riskCategory: RiskCategory = Field(..., description="Risk category")
    modelVersion: str = Field(..., description="Model version")
    explanation: ExplanationModel = Field(..., description="Structured risk explanation")


class HealthResponse(BaseModel):
    """Health check response."""

    status: str
    service: str
