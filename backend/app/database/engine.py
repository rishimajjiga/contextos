"""
app/database/engine.py
Async SQLAlchemy engine, session factory, and Base for all ORM models.
"""
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# Disable prepared statement caching.
# psycopg3 names its prepared statements "_pg3_0", "_pg3_1", etc.
# PgBouncer (transaction mode) doesn't persist prepared statements across
# connections, so on reconnect psycopg3 tries to CREATE them again and gets
# DuplicatePreparedStatement.
#
# psycopg3 prepare_threshold semantics:
#   0    = always prepare (WRONG — causes DuplicatePreparedStatement)
#   None = never prepare  (CORRECT for PgBouncer transaction mode)
# `connect_timeout` (psycopg) / `timeout` (asyncpg) bound how long a brand-new
# DB connection may take to establish. Without it, when Supabase is paused or
# the network is down, each request hangs on connect for ~30s+ — long enough
# that the frontend's HTTP client times out and shows the misleading
# "Backend not reachable" banner. A short connect timeout makes the API fail
# fast with a clear 5xx instead. Both params are client-side and safe through
# the Supabase PgBouncer pooler (unlike the `options` startup parameter).
if "asyncpg" in settings.database_url:
    _connect_args = {"statement_cache_size": 0, "timeout": 10}
else:
    _connect_args = {"prepare_threshold": None, "connect_timeout": 10}

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    pool_recycle=300,
    pool_timeout=30,
    connect_args=_connect_args,
)


# Belt-and-suspenders: enforce prepare_threshold=None at the connection level
# so that even connections already in the pool get the correct setting.
@event.listens_for(engine.sync_engine, "connect")
def on_new_connection(dbapi_connection, connection_record):
    # SQLAlchemy's async psycopg3 driver hands us an adapter wrapper here, not
    # the raw connection. prepare_threshold lives on the underlying driver
    # connection (.driver_connection); setting it on the wrapper raises
    # AttributeError. asyncpg has no such attribute, so guard with hasattr.
    raw = getattr(dbapi_connection, "driver_connection", dbapi_connection)
    if hasattr(raw, "prepare_threshold"):
        try:
            raw.prepare_threshold = None  # None = never prepare (0 = always prepare)
        except (AttributeError, TypeError):
            pass


AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Shared declarative base for all SQLAlchemy models."""
    pass


async def get_db() -> AsyncSession:  # type: ignore[override]
    """FastAPI dependency that yields an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
