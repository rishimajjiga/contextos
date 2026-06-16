"""
app/main.py
FastAPI application entry point.
Registers middleware, routers, and lifecycle events.
"""
import structlog
import sqlalchemy as sa
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import engine, Base
from app.api.v1 import router as v1_router
from app.middleware.logging import LoggingMiddleware

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle hook."""
    log.info("ContextOS starting", env=settings.app_env)

    # Create tables if they don't exist (dev convenience).
    # In production, use Alembic migrations instead.
    if not settings.is_production:
        async with engine.begin() as conn:
            # Idempotent: add columns introduced after initial table creation.
            # Backend self-heals on restart -- no manual alembic needed in dev.
            await conn.execute(sa.text(
                "ALTER TABLE IF EXISTS documents "
                "ADD COLUMN IF NOT EXISTS visibility VARCHAR(16) NOT NULL DEFAULT 'private'"
            ))
            await conn.run_sync(Base.metadata.create_all)

    yield

    log.info("ContextOS shutting down")
    await engine.dispose()


# Rate Limiter

limiter = Limiter(key_func=get_remote_address)

# Application

app = FastAPI(
    title="ContextOS API",
    description="The memory layer for AI -- store identity, projects, and knowledge once.",
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# Middleware

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# In development allow all origins (covers chrome-extension://, localhost ports, etc.)
# In production, restrict to configured origins only.
_cors_origins = ["*"] if not settings.is_production else settings.cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=not ("*" in _cors_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(LoggingMiddleware)

# Routers

app.include_router(v1_router, prefix="/api/v1")


# Health

@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "version": "0.1.0", "env": settings.app_env}
