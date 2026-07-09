from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
DEFAULT_JWT_SECRET = "development-only-change-me-at-least-32-bytes"


@dataclass(frozen=True, slots=True)
class AppSettings:
    app_env: str = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower()
    database_url: str = os.getenv(
        "DATABASE_URL", f"sqlite+aiosqlite:///{(BASE_DIR / 'reyohoho.db').as_posix()}"
    )
    jwt_secret: str = os.getenv("JWT_SECRET", DEFAULT_JWT_SECRET)
    jwt_issuer: str = os.getenv("JWT_ISSUER", "reyohoho-backend")
    jwt_audience: str = os.getenv("JWT_AUDIENCE", "reyohoho-frontend")
    jwt_ttl_seconds: int = int(os.getenv("JWT_TTL_SECONDS", "2592000"))
    telegram_bot_username: str = os.getenv("TELEGRAM_BOT_USERNAME", "")
    telegram_bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_webhook_secret: str = os.getenv("TELEGRAM_WEBHOOK_SECRET", "")
    telegram_login_ttl_seconds: int = int(os.getenv("TELEGRAM_LOGIN_TTL_SECONDS", "600"))
    twitch_client_id: str = os.getenv("TWITCH_CLIENT_ID", "")
    twitch_client_secret: str = os.getenv("TWITCH_CLIENT_SECRET", "")
    parental_guide_url: str = os.getenv("PARENTAL_GUIDE_URL", "")

    def __post_init__(self) -> None:
        if self.app_env in {"prod", "production"} and self.jwt_secret == DEFAULT_JWT_SECRET:
            raise RuntimeError("JWT_SECRET must be set to a strong value in production")


SETTINGS = AppSettings()
