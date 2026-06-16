from pydantic import BaseModel, Field

class LoanApplication(BaseModel):
    age: int = Field(..., gt=0, lt=120)
    annualIncome: float = Field(..., ge=0)
    employmentType: str  # "FULL_TIME", "PART_TIME", "UNEMPLOYED", "SELF_EMPLOYED"
    existingDebt: float = Field(..., ge=0)
    creditScore: int = Field(..., ge=300, le=850)
    loanAmount: float = Field(..., gt=0)

def map_to_features(loan: LoanApplication) -> list:
    # Deterministic mapping to 24 features expected by the model.
    # Note: This mapping is a simplified example based on the 
    # original german.data-numeric dataset structure.
    
    features = [0] * 24
    
    # Example mapping (highly dependent on original dataset encoding)
    features[0] = loan.age
    features[1] = loan.annualIncome
    features[2] = loan.creditScore
    features[3] = loan.loanAmount
    features[4] = loan.existingDebt
    
    # Map employment type to specific features if required by model
    if loan.employmentType == "FULL_TIME":
        features[5] = 1
    elif loan.employmentType == "PART_TIME":
        features[6] = 1
    # ... rest of the 24 features
    
    return features
