"""
app/api/v1/dependencies.py
Shared FastAPI dependencies used across all v1 endpoint modules.
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware import get_current_user_id
from app.services import get_or_provision_user


async def get_user_id(
    clerk_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> str:
    """
    Resolves Clerk ID -> internal user.id.
    Also triggers lazy deletion if grace period has ended.
    Raises 410 Gone if data was just purged.
    """
    from app.services.subscription_service import purge_if_grace_expired
    user = await get_or_provision_user(db, clerk_id)
    purged = await purge_if_grace_expired(db, user.id)
    if purged:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail={
                "code": "DATA_DELETED",
                "message": (
                    "Your 30-day grace period has ended. "
                    "All your data has been permanently deleted."
                ),
            },
        )
    return user.id


async def get_user_id_no_purge(
    clerk_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> str:
    """
    Like get_user_id but skips the purge check.
    Used by the download-backup endpoint so users can still
    download their data even if the grace period just ended.
    """
    user = await get_or_provision_user(db, clerk_id)
    return user.id
