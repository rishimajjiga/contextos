"""
tests/conftest.py
Shared pytest fixtures for the ContextOS test suite.

Strategy
--------
- Use SQLite in-memory (aiosqlite) so tests run without a real PostgreSQL.
- Override `get_db` with a per-test async session on the in-memory DB.
- Override `get_user_id` from dependencies.py so all protected routes
  receive the fixed test user ID — no JWT or API key needed.
- Override `get_current_user_id` to bypass Clerk JWKS entirely.

Install extras before running:
  pip install aiosqlite pytest-asyncio --break-system-packages
"""
import asyncio
import pytest
import pytest_asyncio
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.database import get_db, Base
from app.api.v1.dependencies import get_user_id
from app.middleware.auth import get_current_user_id

# ─── Constants ────────────────────────────────────────────────────────────────

TEST_USER_ID = "test-user-00000000-0000-0000-0000-000000000001"
TEST_CLERK_ID = "user_test_clerk_id"

# ─── In-memory SQLite engine ──────────────────────────────────────────────────

# aiosqlite lets SQLAlchemy use SQLite asynchronously
# The URL uses a shared cache so all connections in the same process see the data
TEST_DATABASE_URL = "sqlite+aiosqlite:///file::memory:?cache=shared&uri=true"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

TestSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    """Use a single event loop for the whole test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    """Create all tables once before the test session, drop after."""
    import app.models  # Ensure all models are registered on Base.metadata
    
    # Keep one connection alive throughout the session so the shared-cache in-memory SQLite DB is not wiped
    connection = await test_engine.connect()
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await connection.close()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield a fresh async session, roll back, and clear all tables after each test."""
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()
    
    # Delete all data in reverse-dependency order to preserve integrity and isolate tests
    async with test_engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """
    HTTPX AsyncClient pointed at the FastAPI app with:
      - DB overridden to use in-memory SQLite
      - Auth overridden to bypass Clerk and return the test user
    """
    async def override_get_db():
        yield db_session

    async def override_get_user_id() -> str:
        return TEST_USER_ID

    async def override_get_current_user_id() -> str:
        return TEST_CLERK_ID

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_user_id] = override_get_user_id
    app.dependency_overrides[get_current_user_id] = override_get_current_user_id

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://testserver",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()
