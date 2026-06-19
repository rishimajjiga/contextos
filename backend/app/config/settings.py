"""
app/config/settings.py
Centralised settings loaded from environment variables via Pydantic Settings.
"""
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

    # ── App ────────────────────────────────────────────────────────────────
    app_name: str = "ContextOS"
    app_env: str = "development"
    debug: bool = False
    secret_key: str = Field(..., min_length=32)

    # ── Database ──────────────────────────────────────────────────────────
    database_url: str

    # ── Clerk ─────────────────────────────────────────────────────────────
    clerk_secret_key: str
    clerk_publishable_key: str
    clerk_jwks_url: str

    # ── Supabase ──────────────────────────────────────────────────────────
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str
    supabase_bucket: str = "contextos-documents"

    # ── CORS ──────────────────────────────────────────────────────────────
    cors_origins: str | List[str] = ["http://localhost:5173"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: str | List[str]) -> List[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            # If it looks like a JSON array, parse it as JSON
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                import json
                try:
                    return json.loads(v_stripped)
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",")]
        return v

    # ── Razorpay ──────────────────────────────────────────────────────────
    razorpay_key_id: str = ""              # rzp_test_xxx / rzp_live_xxx
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    razorpay_pro_plan_id: str = ""         # Pro monthly plan_xxx
    razorpay_pro_annual_plan_id: str = ""  # Pro annual plan_xxx
    razorpay_team_plan_id: str = ""        # Team monthly plan_yyy
    razorpay_team_annual_plan_id: str = "" # Team annual plan_yyy
    razorpay_student_plan_id: str = ""     # Student plan_zzz

    # ── Rate limiting ─────────────────────────────────────────────────────
    rate_limit_per_minute: int = 60

    # ── Derived helpers ───────────────────────────────────────────────────
    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def sync_database_url(self) -> str:
        """Synchronous database URL for Alembic migrations.
        Converts any async driver prefix (asyncpg or psycopg3) to psycopg2.
        """
        url = self.database_url
        # psycopg3 async driver: postgresql+psycopg://
        url = url.replace("postgresql+psycopg://", "postgresql+psycopg2://")
        # asyncpg async driver: postgresql+asyncpg://
        url = url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
        return url


# Module-level singleton — import this everywhere
settings = Settings()  # type: ignore[call-arg]
