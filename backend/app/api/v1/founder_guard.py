"""
app/api/v1/founder_guard.py
Backend authorization for the Founder Panel.

The Founder account IS the administrator — no separate role or login. Access is
granted purely by the logged-in user's email matching FOUNDER_EMAILS, verified
SERVER-SIDE on every founder endpoint. Any non-founder receives 403 Forbidden.
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.v1.dependencies import get_user_id
from app.services.subscription_service import _is_founder


async def require_founder(
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
) -> str:
    """Dependency: allow only configured founder accounts. Returns the founder's
    internal user_id for use in endpoints (e.g. activity-log actor). 403 for
    everyone else — never trust the frontend's own gating."""
    if not await _is_founder(db, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Founder access required.",
        )
    return user_id


async def founder_email(db: AsyncSession, user_id: str) -> str:
    from app.models.user import User
    return (
        await db.execute(select(User.email).where(User.id == user_id))
    ).scalar_one_or_none() or ""
