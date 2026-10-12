"""Configuration tests for runtime-independent model artifact paths."""
from pathlib import Path

from app.core.config import AI_SERVICE_ROOT, Settings


def test_default_model_directory_is_independent_of_working_directory(monkeypatch, tmp_path):
    monkeypatch.delenv("MODEL_DIR", raising=False)
    monkeypatch.chdir(tmp_path)

    settings = Settings(_env_file=None)

    assert settings.MODEL_DIR == AI_SERVICE_ROOT / "models"
    assert settings.MODEL_DIR.is_absolute()
    assert (settings.MODEL_DIR / settings.MODEL_NAME).is_file()
    assert (settings.MODEL_DIR / settings.SCALER_NAME).is_file()
