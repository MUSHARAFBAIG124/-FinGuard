"""Synthetic training dataset generator."""
import numpy as np
import pandas as pd


def generate_synthetic_dataset(n_samples: int = 1000, random_state: int = 42) -> pd.DataFrame:
    """
    Generate synthetic loan dataset for training.

    Args:
        n_samples: Number of samples to generate
        random_state: Random seed for reproducibility

    Returns:
        DataFrame with features and target
    """
    np.random.seed(random_state)

    # Generate features
    data = {
        "age": np.random.randint(18, 80, n_samples),
        "annualIncome": np.random.uniform(20000, 200000, n_samples),
        "employmentType": np.random.choice(
            [0, 1, 2, 3, 4], n_samples, p=[0.5, 0.2, 0.15, 0.1, 0.05]
        ),
        "existingDebt": np.random.uniform(0, 100000, n_samples),
        "creditScore": np.random.randint(300, 850, n_samples),
        "loanAmount": np.random.uniform(5000, 100000, n_samples),
    }

    df = pd.DataFrame(data)

    # Create target variable based on heuristic rules
    # This creates realistic approval patterns
    debt_to_income = df["existingDebt"] / df["annualIncome"]
    loan_to_income = df["loanAmount"] / df["annualIncome"]

    approval_prob = (
        (1 - np.tanh(debt_to_income * 2))  # Lower DTI = higher approval
        * (1 - np.tanh(loan_to_income * 2))  # Lower LTI = higher approval
        * (1 + (df["creditScore"] - 600) / 500)  # Higher credit score = higher approval
        * (1 - (np.abs(df["age"] - 45) / 50) ** 2)  # Middle-aged = slightly higher
        * (1 - df["employmentType"] * 0.1)  # SALARIED (0) = highest, UNEMPLOYED (4) = lowest
        / 2
    )

    # Clip probabilities to valid range
    approval_prob = np.clip(approval_prob, 0, 1)

    # Generate binary target (1 = approved, 0 = rejected)
    df["loanApproved"] = (np.random.random(n_samples) < approval_prob).astype(int)

    return df


if __name__ == "__main__":
    df = generate_synthetic_dataset(n_samples=1000)
    print(f"Generated {len(df)} samples")
    print(f"\nDataset shape: {df.shape}")
    print(f"\nClass distribution:\n{df['loanApproved'].value_counts()}")
    print(f"\nFeature statistics:\n{df.describe()}")
