"""
app/api/v1/endpoints/inbox.py
User-facing endpoints for Founder-Panel-driven features: the in-app notification
inbox, active website banners, and submitting a support ticket. These are NOT
founder-gated — every signed-in user uses them.
"""
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.v1.dependencies import get_user_id
from app.models.founder import (
    AnnouncementBanner, Notification, NotificationRead, SupportTicket,
)
from app.models.subscription import UserSubscription
from app.services.subscription_service import get_user_plan, _is_founder

router = APIRouter()


async def _audience_matches(db: AsyncSession, user_id: str, audience: str,
                            target_user_ids: list[str]) -> bool:
    if audience == "everyone":
        return True
    if audience == "selected":
        return user_id in (target_user_ids or [])
    if audience in ("free", "student", "pro", "team"):
        return (await get_user_plan(db, user_id)) == audience
    return False


@router.get("/founder-access")
async def founder_access(
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Whether the current user is a founder. Drives the Founder Panel menu
    item — the backend still verifies on every founder endpoint regardless."""
    return {"is_founder": await _is_founder(db, user_id)}


@router.get("/notifications")
async def my_notifications(
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    rows = (
        await db.execute(
            select(Notification).where(
                Notification.status == "sent",
                or_(Notification.sent_at.is_(None), Notification.sent_at <= now),
            ).order_by(Notification.created_at.desc()).limit(100)
        )
    ).scalars().all()

    read_ids = set((
        await db.execute(select(NotificationRead.notification_id).where(NotificationRead.user_id == user_id))
    ).scalars().all())

    items = []
    for n in rows:
        targets = json.loads(n.target_user_ids or "[]")
        if not await _audience_matches(db, user_id, n.audience, targets):
            continue
        items.append({
            "id": n.id, "title": n.title, "message": n.message, "type": n.type,
            "created_at": n.created_at.isoformat(), "read": n.id in read_ids,
        })
    return {"notifications": items, "unread": sum(1 for i in items if not i["read"])}


@router.post("/notifications/{notification_id}/read")
async def mark_read(
    notification_id: str,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    existing = (
        await db.execute(
            select(NotificationRead).where(
                NotificationRead.notification_id == notification_id,
                NotificationRead.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(NotificationRead(notification_id=notification_id, user_id=user_id))
        await db.commit()
    return {"ok": True}


@router.get("/banners/active")
async def active_banners(
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    rows = (
        await db.execute(
            select(AnnouncementBanner).where(
                AnnouncementBanner.enabled.is_(True),
                or_(AnnouncementBanner.start_date.is_(None), AnnouncementBanner.start_date <= now),
                or_(AnnouncementBanner.end_date.is_(None), AnnouncementBanner.end_date >= now),
            ).order_by(AnnouncementBanner.created_at.desc())
        )
    ).scalars().all()
    out = []
    for b in rows:
        if not await _audience_matches(db, user_id, b.audience, []):
            continue
        out.append({
            "id": b.id, "title": b.title, "message": b.message,
            "button_text": b.button_text, "button_url": b.button_url,
        })
    return {"banners": out}


class TicketCreate(BaseModel):
    subject: str
    message: str


@router.post("/support-tickets")
async def create_ticket(
    body: TicketCreate,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    t = SupportTicket(user_id=user_id, subject=body.subject, message=body.message, status="open")
    db.add(t)
    await db.commit()
    return {"ok": True, "ticket_id": t.id}
