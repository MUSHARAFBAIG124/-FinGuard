def map_probability_to_category(probability: float) -> str:
    if probability >= 0.80:
        return "LOW"
    elif probability >= 0.50:
        return "MEDIUM"
    else:
        return "HIGH"

def calculate_risk_score(probability: float) -> int:
    # Score 0-100, 100 = highest risk (lowest probability)
    score = (1 - probability) * 100
    return max(0, min(100, int(score)))
