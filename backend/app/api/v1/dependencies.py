"""
app/api/v1/dependencies.py
Shared FastAPI dependencies used across all v1 endpoint modules.

Keeping this in one place eliminates the duplicated _get_user_id function
that previously appeared verbatim in documents, projects, profile, and search.
"""
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware import get_current_user_id
from app.services import get_or_provision_user


async def get_user_id(
    clerk_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> str:
    """
    Resolves the authenticated Clerk ID to our internal user.id.
    Provisions a local user row on first call (sync-on-demand pattern).
    """
    user = await get_or_provision_user(db, clerk_id)
    return user.id
