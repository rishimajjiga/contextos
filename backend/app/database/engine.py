"""
app/database/engine.py
Async SQLAlchemy engine, session factory, and Base for all ORM models.
"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# Disable prepared statement caching for all psycopg3 connections.
# PgBouncer (Supabase pooler, Railway) runs in transaction mode — prepared
# statements created in one transaction are invisible in the next, causing
# DuplicatePreparedStatement errors if we try to reuse them.
# asyncpg uses a different parameter name (statement_cache_size).
if "asyncpg" in settings.database_url:
    _connect_args = {"statement_cache_size": 0}
else:
    # psycopg3 (sync or async): prepare_threshold=0 disables prepared stmts
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
