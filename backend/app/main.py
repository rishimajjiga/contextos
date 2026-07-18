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
from app.database import engine
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

    # Schema is managed EXCLUSIVELY by Alembic migrations (run in the container
    # entrypoint via `alembic upgrade head` before this app process starts —
    # see Dockerfile). This app NEVER creates or alters tables: no
    # Base.metadata.create_all, no CREATE TABLE / ADD COLUMN. Doing so from the
    # ORM previously built the whole schema without ever stamping
    # alembic_version, which made `alembic upgrade` collide with the existing
    # `users` table (DuplicateTable). Startup here only verifies connectivity.
    if settings.database_url:
        try:
            async with engine.connect() as conn:
                await conn.execute(sa.text("SELECT 1"))
            log.info("Database connection OK")
        except Exception as exc:
            log.warning(
                "DB connectivity check failed — server will start anyway. "
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
