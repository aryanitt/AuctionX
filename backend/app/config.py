"""
Application settings loaded from environment variables.

Uses pydantic-settings to validate and type-cast .env values at startup,
so missing or malformed config fails fast instead of at runtime.
"""

from pathlib import Path
from pydantic_settings import BaseSettings

# Resolve .env relative to this file so uvicorn can be started from any directory
_ENV_FILE = Path(__file__).resolve().parent / ".env"


class Settings(BaseSettings):
    MONGO_URI: str
    JWT_SECRET: str
    CLIENT_URL: str = "http://localhost:5173"
    PORT: int = 5000
    CRON_SECRET: str = "change-me-in-production"

    model_config = {"env_file": str(_ENV_FILE)}


settings = Settings()
