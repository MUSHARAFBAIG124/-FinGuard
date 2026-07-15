"""Configuration settings."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # App
    APP_NAME: str = "FinGuard AI Service"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Model paths
    MODEL_DIR: str = "models"
    MODEL_NAME: str = "credit-risk-model.joblib"
    SCALER_NAME: str = "feature-scaler.joblib"

    # Model version
    MODEL_VERSION: str = "1.0.0"

    class Config:
        """Pydantic config."""

        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
