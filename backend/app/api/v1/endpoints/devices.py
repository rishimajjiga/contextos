"""
app/api/v1/endpoints/devices.py
Device (FCM) token registration for mobile push notifications.

The Android app registers its Firebase token here after sign-in and on every
token refresh, authenticating with the same X-Api-Key it already uses for the
bubble/selection features (get_user_id accepts X-Api-Key OR a Clerk Bearer).
Tokens are upserted (unique on the token) and soft-deactivated on sign-out so
the push service never delivers to a stale registration.
"""
from datetime import datetime, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.v1.dependencies import get_user_id
from app.models.device_token import DeviceToken

log = structlog.get_logger()
router = APIRouter()


class DeviceRegister(BaseModel):
    token: str = Field(min_length=1, max_length=512)
    platform: str = "android"          # android | ios | web
    device_name: Optional[str] = Field(default=None, max_length=128)


class DeviceUnregister(BaseModel):
    token: str = Field(min_length=1, max_length=512)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.post("/register")
async def register_device(
    body: DeviceRegister,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Upsert this device's FCM token for the signed-in user. Idempotent: the
    same token re-registering just refreshes ownership/activity. If the token
    moved to a different account (device reused), ownership is reassigned."""
    token = body.token.strip()
    platform = (body.platform or "android").strip().lower()
    if platform not in ("android", "ios", "web"):
        platform = "android"

    existing = (
        await db.execute(select(DeviceToken).where(DeviceToken.token == token))
    ).scalar_one_or_none()

    if existing is not None:
        existing.user_id = user_id
        existing.platform = platform
        existing.device_name = body.device_name
        existing.active = True
        existing.updated_at = _utcnow()
        await db.commit()
        return {"ok": True, "id": existing.id, "created": False}

    row = DeviceToken(
        user_id=user_id, token=token, platform=platform,
        device_name=body.device_name, active=True,
    )
    db.add(row)
    try:
        await db.commit()
    except IntegrityError:
        # Concurrent register of the same token — fall back to an update.
        await db.rollback()
        await db.execute(
            update(DeviceToken)
            .where(DeviceToken.token == token)
            .values(user_id=user_id, platform=platform,
                    device_name=body.device_name, active=True, updated_at=_utcnow())
        )
        await db.commit()
        return {"ok": True, "created": False}

    return {"ok": True, "id": row.id, "created": True}


@router.post("/unregister")
async def unregister_device(
    body: DeviceUnregister,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Soft-deactivate a token on sign-out. Scoped to the caller so one user
    can't deactivate another's device. No error if the token is unknown."""
    await db.execute(
        update(DeviceToken)
        .where(DeviceToken.token == body.token.strip(), DeviceToken.user_id == user_id)
        .values(active=False, updated_at=_utcnow())
    )
    await db.commit()
    return {"ok": True}
