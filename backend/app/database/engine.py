"""
app/database/engine.py
Async SQLAlchemy engine, session factory, and Base for all ORM models.
"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

# PgBouncer (Supabase pooler) requires prepared statements to be disabled.
# asyncpg: statement_cache_size=0  |  psycopg3: prepare_threshold=0
if "asyncpg" in settings.database_url:
    _connect_args = {"statement_cache_size": 0}
elif "pooler.supabase.com" in settings.database_url:
    _connect_args = {"prepare_threshold": 0}
else:
    _connect_args = {}

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
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
