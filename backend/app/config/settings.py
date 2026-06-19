"""
app/config/settings.py
Centralised settings loaded from environment variables via Pydantic Settings.
"""
import sys
from typing import List
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "ContextOS"
    app_env: str = "development"
    debug: bool = False
    # secret_key is not used by the app (Clerk handles auth); default avoids
    # startup failure when the env var is absent or short.
    secret_key: str = Field(default="default-secret-key-not-used-by-app")

    # Database
    database_url: str = ""

    # Clerk
    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""
    clerk_jwks_url: str = ""

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""
    supabase_bucket: str = "contextos-documents"

    # CORS — always include the Vercel production URL so env-var parsing issues
    # can never lock out the frontend.
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://contextos-eta.vercel.app",
    ]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v) -> List[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                import json
                try:
                    return json.loads(v_stripped)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        if isinstance(v, list):
            return v
        return [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://contextos-eta.vercel.app",
        ]

    # Razorpay
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    razorpay_pro_plan_id: str = ""
    razorpay_pro_annual_plan_id: str = ""
    razorpay_team_plan_id: str = ""
    razorpay_team_annual_plan_id: str = ""
    razorpay_student_plan_id: str = ""

    # Frontend
    frontend_url: str = "https://contextos-eta.vercel.app"

    # Email (SMTP)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_pass: str = ""
    email_from: str = "noreply@contextos.app"

    # Cron
    cron_secret: str = ""

    # Rate limiting
    rate_limit_per_minute: int = 60

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


try:
    settings = Settings()
except Exception as exc:
    print(
        f"[ContextOS] FATAL: Settings() failed — {type(exc).__name__}: {exc}",
        file=sys.stderr,
        flush=True,
    )
    raise
