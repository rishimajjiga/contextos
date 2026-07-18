"""
app/api/v1/endpoints/founder.py
Founder Panel API. EVERY route depends on require_founder → 403 for non-founders.
Reuses subscription/billing/founder services; no pricing or rule changes.
"""
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.v1.founder_guard import require_founder, founder_email
from app.models.founder import (
    AnnouncementBanner, FounderActivityLog, ManualGrant, Notification, SupportTicket,
)
from app.models.payment import Payment
from app.models.subscription import UserSubscription
from app.models.user import User
from app.services import founder_service as fs

log = structlog.get_logger()
router = APIRouter()


# ── Dashboard ────────────────────────────────────────────────────────────────

@router.get("/dashboard")
async def founder_dashboard(
    founder_id: str = Depends(require_founder),
    db: AsyncSession = Depends(get_db),
):
    return await fs.dashboard_stats(db)


# ── User management ──────────────────────────────────────────────────────────

@router.get("/users/search")
async def search_users(
    q: str = "",
    limit: int = 25,
    founder_id: str = Depends(require_founder),
    db: AsyncSession = Depends(get_db),
):
    """Search by email, name, or user id (partial, case-insensitive)."""
    stmt = select(User, UserSubscription).join(
        UserSubscription, UserSubscription.user_id == User.id, isouter=True
    )
    term = q.strip()
    if term:
        like = f"%{term.lower()}%"
        stmt = stmt.where(or_(
            func.lower(User.email).like(like),
            func.lower(User.name).like(like),
            User.id == term,
        ))
    stmt = stmt.order_by(User.created_at.desc()).limit(min(limit, 100))
    rows = (await db.execute(stmt)).all()
    return {
        "users": [
            {
                "user_id": u.id, "email": u.email, "name": u.name,
                "plan": (s.plan if s else "free"),
                "status": (s.status if s else "active"),
                "expiry": (s.current_period_end.isoformat() if s and s.current_period_end else None),
                "created_at": u.created_at.isoformat(),
            }
            for u, s in rows
        ]
    }


@router.get("/users/{user_id}")
async def user_detail(
    user_id: str,
    founder_id: str = Depends(require_founder),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    sub = (
        await db.execute(select(UserSubscription).where(UserSubscription.user_id == user_id))
    ).scalar_one_or_none()
    payments = (
        await db.execute(
            select(Payment).where(Payment.user_id == user_id)
            .order_by(Payment.purchase_date.desc()).limit(50)
        )
    ).scalars().all()
    grants = (
        await db.execute(
            select(ManualGrant).where(ManualGrant.user_id == user_id)
            .order_by(ManualGrant.created_at.desc())
        )
    ).scalars().all()
    return {
        "user": {"user_id": user.id, "email": user.email, "name": user.name,
                 "created_at": user.created_at.isoformat()},
        "subscription": None if sub is None else {
            "plan": sub.plan, "status": sub.status,
            "expiry": sub.current_period_end.isoformat() if sub.current_period_end else None,
            "auto_renew": bool(sub.auto_renew),
            "offer_used": bool(getattr(sub, "offer_used", False)),
        },
        "payments": [
            {"payment_id": p.payment_id, "amount": p.amount,
             "amount_display": f"₹{p.amount / 100:,.0f}", "status": p.status,
             "plan": p.plan_name, "date": p.purchase_date.isoformat()}
            for p in payments
        ],
        "manual_grants": [
            {"grant_id": g.id, "plan": g.plan, "duration_days": g.duration_days,
             "reason": g.reason, "category": g.category, "active": g.active,
             "granted_at": g.created_at.isoformat(),
             "expires_at": g.expires_at.isoformat() if g.expires_at else None,
             "removed_at": g.removed_at.isoformat() if g.removed_at else None}
            for g in grants
        ],
    }


class GrantRequest(BaseModel):
    user_id: str
    plan: str                    # free|student|pro|team
    duration: str                # 7d|15d|1m|2m|3m|1y
    reason: str
    mode: str = "grant"          # grant|extend|change
    category: Optional[str] = None   # compensation bucket (optional)


@router.post("/users/grant")
async def grant(
    body: GrantRequest,
    founder_id: str = Depends(require_founder),
    db: AsyncSession = Depends(get_db),
):
    email = await founder_email(db, founder_id)
    try:
        return await fs.grant_plan(
            db, actor_user_id=founder_id, actor_email=email,
            target_user_id=body.user_id, plan=body.plan, duration_key=body.duration,
            reason=body.reason, category=body.category, mode=body.mode,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class CompensateRequest(BaseModel):
    user_id: str
    plan: str
    duration: str
    reason: str                  # e.g. "Website bug", "Payment issue", ...


@router.post("/users/compensate")
async def compensate(
    body: CompensateRequest,
    founder_id: str = Depends(require_founder),
    db: AsyncSession = Depends(get_db),
):
    """Compensation = a manual grant tagged with the reason bucket."""
    email = await founder_email(db, founder_id)
    try:
        return await fs.grant_plan(
            db, actor_user_id=founder_id, actor_email=email,
            target_user_id=body.user_id, plan=body.plan, duration_key=body.duration,
            reason=body.reason, category="compensation", mode="grant",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


class RemoveGrantRequest(BaseModel):
    grant_id: str
    reason: str


@router.post("/users/remove-grant")
async def remove_grant(
    body: RemoveGrantRequest,
    founder_id: str = Depends(require_founder),
    db: AsyncSession = Depends(get_db),
):
    email = await founder_email(db, founder_id)
    try:
        return await fs.remove_grant(
            db, actor_user_id=founder_id, actor_email=email,
            grant_id=body.grant_id, reason=body.reason,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Activity log ─────────────────────────────────────────────────────────────

@router.get("/activity-log")
async def activity_log(
    limit: int = 100, offset: int = 0,
    founder_id: str = Depends(require_founder),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(FounderActivityLog)
            .order_by(FounderActivityLog.created_at.desc())
            .limit(min(limit, 200)).offset(offset)
        )
    ).scalars().all()
    return {
        "entries": [
            {"id": r.id, "date": r.created_at.isoformat(), "action": r.action,
             "actor_email": r.actor_email, "affected_user": r.target_email or r.target_user_id,
             "reason": r.reason, "details": json.loads(r.details or "{}")}
            for r in rows
        ]
    }


# ── Notifications ────────────────────────────────────────────────────────────

class NotificationRequest(BaseModel):
    title: str
    message: str
    type: str = "announcement"    # update|announcement|feature|maintenance|warning
    audience: str = "everyone"    # everyone|free|student|pro|team|selected
    target_user_ids: list[str] = []
    delivery: str = "now"         # now|schedule|draft
    scheduled_at: Optional[str] = None


@router.post("/notifications")
async def create_notification(
    body: NotificationRequest,
    founder_id: str = Depends(require_founder),
    db: AsyncSession = Depends(get_db),
):
    status_map = {"now": "sent", "schedule": "scheduled", "draft": "draft"}
    status = status_map.get(body.delivery, "sent")
    now = datetime.now(timezone.utc)
    scheduled = None
    if body.delivery == "schedule":
        if not body.scheduled_at:
            raise HTTPException(status_code=400, detail="scheduled_at required for scheduled notifications.")
        scheduled = datetime.fromisoformat(body.scheduled_at.replace("Z", "+00:00"))
    n = Notification(
        title=body.title, message=body.message, type=body.type,
        audience=body.audience, target_user_ids=json.dumps(body.target_user_ids or []),
        status=status, scheduled_at=scheduled,
        sent_at=now if status == "sent" else None, created_by=founder_id,
    )
    db.add(n)
    await db.flush()
    email = await founder_email(db, founder_id)
    await fs.log_action(
        db, actor_user_id=founder_id, actor_email=email, action="send_notification",
        reason=body.type, details={"notification_id": n.id, "audience": body.audience,
                                   "delivery": body.delivery, "title": body.title},
        commit=False,
    )
    await db.commit()
    return {"ok": True, "notification_id": n.id, "status": status}


@router.get("/notifications")
async def list_notifications(
    founder_id: str = Depends(require_founder),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(select(Notification).order_by(Notification.created_at.desc()).limit(100))
    ).scalars().all()
    return {"notifications": [
        {"id": n.id, "title": n.title, "message": n.message, "type": n.type,
         "audience": n.audience, "status": n.status,
         "scheduled_at": n.scheduled_at.isoformat() if n.scheduled_at else None,
         "created_at": n.created_at.isoformat()}
        for n in rows
    ]}


# ── Announcement banners ─────────────────────────────────────────────────────

class BannerRequest(BaseModel):
    title: str
    message: str
    button_text: Optional[str] = None
    button_url: Optional[str] = None
    audience: str = "everyone"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    enabled: bool = True


def _parse_dt(v: Optional[str]) -> Optional[datetime]:
    return datetime.fromisoformat(v.replace("Z", "+00:00")) if v else None


@router.post("/banners")
async def create_banner(
    body: BannerRequest,
    founder_id: str = Depends(require_founder),
    db: AsyncSession = Depends(get_db),
):
    b = AnnouncementBanner(
        title=body.title, message=body.message, button_text=body.button_text,
        button_url=body.button_url, audience=body.audience,
        start_date=_parse_dt(body.start_date), end_date=_parse_dt(body.end_date),
        enabled=body.enabled, created_by=founder_id,
    )
    db.add(b)
    await db.flush()
    email = await founder_email(db, founder_id)
    await fs.log_action(db, actor_user_id=founder_id, actor_email=email,
                        action="create_banner", reason=body.title,
                        details={"banner_id": b.id}, commit=False)
    await db.commit()
    return {"ok": True, "banner_id": b.id}


@router.get("/banners")
async def list_banners(
    founder_id: str = Depends(require_founder),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(select(AnnouncementBanner).order_by(AnnouncementBanner.created_at.desc()))).scalars().all()
    return {"banners": [
        {"id": b.id, "title": b.title, "message": b.message, "button_text": b.button_text,
         "button_url": b.button_url, "audience": b.audience, "enabled": b.enabled,
         "start_date": b.start_date.isoformat() if b.start_date else None,
         "end_date": b.end_date.isoformat() if b.end_date else None}
        for b in rows
    ]}


class BannerToggle(BaseModel):
    enabled: bool


@router.patch("/banners/{banner_id}")
async def toggle_banner(
    banner_id: str, body: BannerToggle,
    founder_id: str = Depends(require_founder),
    db: AsyncSession = Depends(get_db),
):
    b = (await db.execute(select(AnnouncementBanner).where(AnnouncementBanner.id == banner_id))).scalar_one_or_none()
    if b is None:
        raise HTTPException(status_code=404, detail="Banner not found.")
    b.enabled = body.enabled
    await db.commit()
    return {"ok": True, "enabled": b.enabled}


# ── Support tickets ──────────────────────────────────────────────────────────

@router.get("/support-tickets")
async def list_tickets(
    status: Optional[str] = None,
    founder_id: str = Depends(require_founder),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(SupportTicket, User.email).join(User, User.id == SupportTicket.user_id, isouter=True)
    if status:
        stmt = stmt.where(SupportTicket.status == status)
    rows = (await db.execute(stmt.order_by(SupportTicket.created_at.desc()).limit(200))).all()
    return {"tickets": [
        {"id": t.id, "user_id": t.user_id, "email": email, "subject": t.subject,
         "message": t.message, "status": t.status, "resolution_note": t.resolution_note,
         "created_at": t.created_at.isoformat()}
        for t, email in rows
    ]}


class TicketStatus(BaseModel):
    status: str                  # open|in_progress|resolved
    resolution_note: Optional[str] = None


@router.patch("/support-tickets/{ticket_id}")
async def update_ticket(
    ticket_id: str, body: TicketStatus,
    founder_id: str = Depends(require_founder),
    db: AsyncSession = Depends(get_db),
):
    if body.status not in ("open", "in_progress", "resolved"):
        raise HTTPException(status_code=400, detail="Invalid status.")
    t = (await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))).scalar_one_or_none()
    if t is None:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    t.status = body.status
    if body.resolution_note is not None:
        t.resolution_note = body.resolution_note
    email = await founder_email(db, founder_id)
    await fs.log_action(db, actor_user_id=founder_id, actor_email=email,
                        action="update_ticket", target_user_id=t.user_id,
                        reason=body.status, details={"ticket_id": ticket_id}, commit=False)
    await db.commit()
    return {"ok": True, "status": t.status}


# ── Analytics ────────────────────────────────────────────────────────────────

@router.get("/analytics")
async def analytics(
    days: int = 14,
    founder_id: str = Depends(require_founder),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=min(days, 90))

    # New users per day
    new_user_rows = (
        await db.execute(
            select(func.date(User.created_at), func.count())
            .where(User.created_at >= since)
            .group_by(func.date(User.created_at))
            .order_by(func.date(User.created_at))
        )
    ).all()
    new_users = [{"date": str(d), "count": c} for d, c in new_user_rows]

    # Revenue per day (captured)
    rev_rows = (
        await db.execute(
            select(func.date(Payment.purchase_date), func.coalesce(func.sum(Payment.amount), 0))
            .where(Payment.status == "captured", Payment.purchase_date >= since)
            .group_by(func.date(Payment.purchase_date))
            .order_by(func.date(Payment.purchase_date))
        )
    ).all()
    revenue = [{"date": str(d), "amount": int(a)} for d, a in rev_rows]

    # Subscription conversions = captured pro/team payments in window
    conversions = (
        await db.execute(
            select(func.count()).select_from(Payment).where(
                Payment.status == "captured", Payment.purchase_date >= since,
                Payment.plan_name.in_(("pro", "team", "student")),
            )
        )
    ).scalar_one()

    return {
        "window_days": min(days, 90),
        "new_users": new_users,
        "revenue": revenue,
        "subscription_conversions": conversions,
        # DAU / feature-usage / storage require event tracking not yet in the
        # schema; exposed as null so the UI can show "not tracked yet" rather
        # than a fabricated number.
        "daily_active_users": None,
        "most_used_features": None,
        "storage_usage": None,
    }
