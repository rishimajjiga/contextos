"""
app/main.py
FastAPI application entry point.
Registers middleware, routers, and lifecycle events.
"""
import logging
import structlog
import sqlalchemy as sa
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import engine, Base
from app.api.v1 import router as v1_router
from app.middleware.logging import LoggingMiddleware

# Without an explicit configure() call, structlog silently ignores
# contextvars.bind_contextvars() (used by LoggingMiddleware to attach a
# request_id) — merge_contextvars must be in the processor chain for that id
# to actually reach the rendered log line. JSON in production (so Railway's
# log search can filter by request_id), readable console output locally.
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer() if settings.is_production else structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

log = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle hook."""
    log.info("ContextOS starting", env=settings.app_env)

    # Run the idempotent schema setup on every boot, including production.
    # Alembic versions are gitignored, so they don't ship to Railway; these
    # CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS statements are what
    # keep the managed (Supabase) schema current. Skipping them in production
    # left the prod DB missing newer columns (e.g. documents.doc_type,
    # user_subscriptions.grace_period_end), causing 500s on /memories,
    # /billing/plan, etc. Guard only on having a database configured.
    if settings.database_url:
        try:
            async with engine.begin() as conn:
                # Create all ORM-mapped tables that don't exist yet
                await conn.run_sync(Base.metadata.create_all)

                # thread_events table (not in Base metadata — created manually)
                await conn.execute(sa.text(
                    "CREATE TABLE IF NOT EXISTS thread_events ("
                    "    id VARCHAR(36) PRIMARY KEY,"
                    "    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,"
                    "    user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,"
                    "    event_type VARCHAR(64) NOT NULL,"
                    "    title VARCHAR(255) NOT NULL,"
                    "    detail TEXT NOT NULL DEFAULT '',"
                    "    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),"
                    "    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
                    ")"
                ))
                await conn.execute(sa.text(
                    "CREATE INDEX IF NOT EXISTS ix_thread_events_project_id "
                    "ON thread_events (project_id)"
                ))
                await conn.execute(sa.text(
                    "CREATE INDEX IF NOT EXISTS ix_thread_events_user_id "
                    "ON thread_events (user_id)"
                ))

                # Backfill missing columns on the documents table.
                await conn.execute(sa.text(
                    "ALTER TABLE documents "
                    "ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) "
                    "NOT NULL DEFAULT 'private'"
                ))
                await conn.execute(sa.text(
                    "ALTER TABLE documents "
                    "ADD COLUMN IF NOT EXISTS doc_type VARCHAR(50) "
                    "NOT NULL DEFAULT 'note'"
                ))
                await conn.execute(sa.text(
                    "ALTER TABLE documents "
                    "ADD COLUMN IF NOT EXISTS org_id VARCHAR(36)"
                ))
                await conn.execute(sa.text(
                    "CREATE INDEX IF NOT EXISTS ix_documents_org_id "
                    "ON documents (org_id)"
                ))

                # user_subscriptions
                await conn.execute(sa.text("""
                    CREATE TABLE IF NOT EXISTS user_subscriptions (
                        id VARCHAR(36) PRIMARY KEY,
                        user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        plan VARCHAR(32) NOT NULL DEFAULT 'free',
                        stripe_customer_id VARCHAR(255),
                        stripe_subscription_id VARCHAR(255),
                        status VARCHAR(32) NOT NULL DEFAULT 'active',
                        current_period_end TIMESTAMPTZ,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        CONSTRAINT uq_user_subscriptions_user_id UNIQUE (user_id)
                    )
                """))
                await conn.execute(sa.text(
                    "CREATE INDEX IF NOT EXISTS ix_user_subscriptions_user_id "
                    "ON user_subscriptions (user_id)"
                ))

                # Backfill grace period columns (migration 0004)
                await conn.execute(sa.text(
                    "ALTER TABLE user_subscriptions "
                    "ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMPTZ"
                ))
                await conn.execute(sa.text(
                    "ALTER TABLE user_subscriptions "
                    "ADD COLUMN IF NOT EXISTS backup_sent BOOLEAN NOT NULL DEFAULT FALSE"
                ))

                # Backfill subscription tracking columns. These were added to the
                # ORM model later; existing prod tables lacked them, which made
                # EVERY authenticated request 500 (get_user_id -> subscription
                # lookup selects started_at/auto_renew).
                await conn.execute(sa.text(
                    "ALTER TABLE user_subscriptions "
                    "ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ"
                ))
                await conn.execute(sa.text(
                    "ALTER TABLE user_subscriptions "
                    "ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT TRUE"
                ))
                # trial_used (one-time Student trial guard). Without this backfill
                # the new ORM column makes EVERY authenticated request 500, since
                # get_user_id -> subscription lookup selects trial_used.
                await conn.execute(sa.text(
                    "ALTER TABLE user_subscriptions "
                    "ADD COLUMN IF NOT EXISTS trial_used BOOLEAN NOT NULL DEFAULT FALSE"
                ))

                # payments table — individual Razorpay transaction records
                await conn.execute(sa.text("""
                    CREATE TABLE IF NOT EXISTS payments (
                        id VARCHAR(36) PRIMARY KEY,
                        user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        payment_id VARCHAR(128) NOT NULL,
                        order_id VARCHAR(128),
                        subscription_id VARCHAR(128),
                        amount INTEGER NOT NULL,
                        currency VARCHAR(8) NOT NULL DEFAULT 'INR',
                        status VARCHAR(32) NOT NULL DEFAULT 'captured',
                        plan_name VARCHAR(32) NOT NULL DEFAULT 'pro',
                        purchase_date TIMESTAMPTZ NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        CONSTRAINT uq_payments_payment_id UNIQUE (payment_id)
                    )
                """))
                await conn.execute(sa.text(
                    "CREATE INDEX IF NOT EXISTS ix_payments_user_id ON payments (user_id)"
                ))
                await conn.execute(sa.text(
                    "CREATE INDEX IF NOT EXISTS ix_payments_payment_id ON payments (payment_id)"
                ))
                await conn.execute(sa.text(
                    "CREATE INDEX IF NOT EXISTS ix_payments_subscription_id ON payments (subscription_id)"
                ))

            log.info("Database tables ready")
        except Exception as exc:
            log.warning(
                "DB startup check failed — server will start anyway. "
                "Check your DATABASE_URL and that Supabase is not paused.",
                error=str(exc),
            )

    yield

    log.info("ContextOS shutting down")
    await engine.dispose()


# Rate Limiter

limiter = Limiter(key_func=get_remote_address)

# Application

app = FastAPI(
    title="ContextOS API",
    description="Remember everything. Your second brain for creators and developers.",
    version="0.1.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)

# Middleware

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Production origins: https://www.usecontextos.com and https://usecontextos.com
# call the API cross-origin. We allow all origins ("*") with credentials OFF —
# auth is a Clerk Bearer token (not a cookie), so wildcard CORS is safe and the
# browser accepts it for non-credentialed requests.
_cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,  # cannot combine wildcard origins with credentials
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.add_middleware(LoggingMiddleware)

# Response compression. Gzips JSON/text responses > 500 bytes, typically a
# 60-80% transfer reduction on list endpoints (memories, projects, payments).
# Outermost middleware so it compresses the fully-formed response.
app.add_middleware(GZipMiddleware, minimum_size=500)

# Routers

app.include_router(v1_router, prefix="/api/v1")


# Health

# Unhandled-exception handler.
# Starlette's default 500 response carries NO CORS headers, so when a save
# (memories/projects/team/payments) hits an unexpected error the browser hides
# it behind a misleading "No 'Access-Control-Allow-Origin' header" CORS error.
# Echo the request Origin back on 500s so the real error reaches the frontend.
@app.exception_handler(Exception)
async def _unhandled_exception_handler(request: Request, exc: Exception):
    log.error(
        "unhandled_exception",
        path=request.url.path,
        method=request.method,
        error=str(exc),
        error_type=type(exc).__name__,
    )
    origin = request.headers.get("origin") or "*"
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again in a moment."},
        headers={"Access-Control-Allow-Origin": origin, "Vary": "Origin"},
    )


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "version": "0.1.0", "env": settings.app_env}


# DB connectivity diagnostic — unauthenticated GET so it can be hit from a
# browser or curl. Returns the REAL database error (truncated) when the DB is
# unreachable/paused, which is otherwise hidden behind the generic 500.
@app.get("/health/db", tags=["health"])
async def health_db():
    from sqlalchemy import text as _sql_text
    try:
        async with engine.connect() as conn:
            await conn.execute(_sql_text("SELECT 1"))
        return {"db": "ok"}
    except Exception as exc:
        log.error("health_db_failed", error=str(exc), error_type=type(exc).__name__)
        return JSONResponse(
            status_code=503,
            content={
                "db": "error",
                "error_type": type(exc).__name__,
                "detail": str(exc)[:600],
            },
        )
