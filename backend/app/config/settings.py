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
        populate_by_name=True,
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

    # CORS — bound to a plain str so pydantic-settings never JSON-decodes the
    # CORS_ORIGINS env var (a comma-separated value would otherwise raise a
    # SettingsError at import time). Parsed into a list by the property below.
    cors_origins_raw: str = Field(default="", alias="CORS_ORIGINS")

    @property
    def cors_origins(self) -> List[str]:
        defaults = [
            "http://localhost:5173",
            "http://localhost:3000",
            "https://contextos-eta.vercel.app",
        ]
        v = self.cors_origins_raw.strip()
        if not v:
            return defaults
        if v.startswith("[") and v.endswith("]"):
            import json
            try:
                return json.loads(v)
            except Exception:
                pass
        return [origin.strip() for origin in v.split(",") if origin.strip()]

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

    # Founder accounts — comma-separated emails granted internal lifetime access.
    # Not exposed via any API; consumed only by server-side authorization.
    founder_emails_raw: str = Field(default="majjigarishi291@gmail.com", alias="FOUNDER_EMAILS")

    @property
    def founder_emails(self) -> set[str]:
        return {e.strip().lower() for e in self.founder_emails_raw.split(",") if e.strip()}

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
