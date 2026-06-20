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
# DuplicatePreparedStatement. Setting prepare_threshold=0 prevents psycopg3
# from ever creating server-side prepared statements.
if "asyncpg" in settings.database_url:
    _connect_args = {"statement_cache_size": 0}
else:
    _connect_args = {"prepare_threshold": 0}

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


# Belt-and-suspenders: enforce prepare_threshold=0 at the connection level
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
            raw.prepare_threshold = 0
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
