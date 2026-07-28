"""
app/services/founder_service.py
Reusable business logic for the Founder Panel. Grants/extends/changes plans by
driving the SAME UserSubscription fields the billing system uses — no pricing
or subscription-rule changes, no duplicated business logic.
"""
import json
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.device_token import DeviceToken
from app.models.founder import FounderActivityLog, ManualGrant
from app.models.payment import Payment
from app.models.session import AISession
from app.models.subscription import UserSubscription
from app.models.user import User
from app.services.subscription_service import (
    PLAN_LIMITS, get_or_create_subscription,
)

log = structlog.get_logger()

VALID_PLANS = ("free", "student", "pro", "team")

# Founder-selectable durations → days (calendar-approximate; months=30, year=365).
DURATION_DAYS = {
    "7d": 7, "15d": 15, "1m": 30, "2m": 60, "3m": 90, "1y": 365,
}


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


async def log_action(
    db: AsyncSession, *, actor_user_id: str, actor_email: str, action: str,
    target_user_id: Optional[str] = None, target_email: Optional[str] = None,
    reason: str = "", details: Optional[dict] = None, commit: bool = True,
) -> None:
    db.add(FounderActivityLog(
        actor_user_id=actor_user_id, actor_email=actor_email, action=action,
        target_user_id=target_user_id, target_email=target_email,
        reason=reason or "", details=json.dumps(details or {}, default=str),
    ))
    if commit:
        await db.commit()


async def grant_plan(
    db: AsyncSession, *, actor_user_id: str, actor_email: str, target_user_id: str,
    plan: str, duration_key: str, reason: str, category: Optional[str] = None,
    mode: str = "grant",   # grant | extend | change
) -> dict:
    """Grant / extend / change a user's plan for a chosen duration.

    - grant/change: access runs `duration` from now.
    - extend: `duration` is added on top of the current period end.
    Records a ManualGrant (with pre-grant snapshot for clean revert) and writes
    an activity-log entry. Reason is REQUIRED by the caller.
    """
    if plan not in VALID_PLANS:
        raise ValueError(f"Unsupported plan '{plan}'.")
    if duration_key not in DURATION_DAYS:
        raise ValueError(f"Unsupported duration '{duration_key}'.")
    if not reason or not reason.strip():
        raise ValueError("A reason is required for every founder action.")

    days = DURATION_DAYS[duration_key]
    sub = await get_or_create_subscription(db, target_user_id)
    now = datetime.now(timezone.utc)

    prev_plan = sub.plan
    prev_period_end = _aware(sub.current_period_end)

    if mode == "extend" and prev_period_end and prev_period_end > now:
        base = prev_period_end
    else:
        base = now
    new_end = base + timedelta(days=days)

    sub.plan = plan
    sub.status = "active"
    sub.grace_period_end = None
    sub.current_period_end = None if plan == "free" else new_end
    if sub.started_at is None:
        sub.started_at = now

    grant = ManualGrant(
        user_id=target_user_id, plan=plan, duration_days=days, reason=reason.strip(),
        category=category, granted_by=actor_user_id, expires_at=sub.current_period_end,
        prev_plan=prev_plan, prev_period_end=prev_period_end, active=True,
    )
    db.add(grant)
    await db.flush()

    target_email = (
        await db.execute(select(User.email).where(User.id == target_user_id))
    ).scalar_one_or_none()
    await log_action(
        db, actor_user_id=actor_user_id, actor_email=actor_email,
        action={"grant": "grant_plan", "extend": "extend_plan", "change": "change_plan"}.get(mode, "grant_plan"),
        target_user_id=target_user_id, target_email=target_email, reason=reason,
        details={
            "mode": mode, "plan": plan, "duration": duration_key, "days": days,
            "category": category, "from_plan": prev_plan,
            "new_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
            "grant_id": grant.id,
        },
        commit=False,
    )
    await db.commit()
    log.info("founder_grant_plan", actor=actor_user_id, target=target_user_id,
             plan=plan, duration=duration_key, mode=mode)
    return {
        "ok": True, "grant_id": grant.id, "plan": sub.plan,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
    }


async def remove_grant(
    db: AsyncSession, *, actor_user_id: str, actor_email: str, grant_id: str, reason: str,
) -> dict:
    """Revert a manual grant: restore the pre-grant plan + period end, mark the
    grant removed, and log it. Reason required."""
    if not reason or not reason.strip():
        raise ValueError("A reason is required for every founder action.")
    grant = (
        await db.execute(select(ManualGrant).where(ManualGrant.id == grant_id))
    ).scalar_one_or_none()
    if grant is None:
        raise ValueError("Manual grant not found.")
    if not grant.active:
        return {"ok": True, "already_removed": True, "grant_id": grant_id}

    sub = await get_or_create_subscription(db, grant.user_id)
    now = datetime.now(timezone.utc)
    sub.plan = grant.prev_plan or "free"
    sub.current_period_end = _aware(grant.prev_period_end)
    sub.status = "active"

    grant.active = False
    grant.removed_at = now
    grant.removed_reason = reason.strip()

    target_email = (
        await db.execute(select(User.email).where(User.id == grant.user_id))
    ).scalar_one_or_none()
    await log_action(
        db, actor_user_id=actor_user_id, actor_email=actor_email, action="remove_grant",
        target_user_id=grant.user_id, target_email=target_email, reason=reason,
        details={"grant_id": grant_id, "restored_plan": sub.plan}, commit=False,
    )
    await db.commit()
    log.info("founder_remove_grant", actor=actor_user_id, grant_id=grant_id)
    return {"ok": True, "grant_id": grant_id, "restored_plan": sub.plan}


async def dashboard_stats(db: AsyncSession) -> dict:
    """Aggregate metrics for the founder dashboard."""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()

    # Plan distribution
    plan_rows = (
        await db.execute(
            select(UserSubscription.plan, func.count())
            .group_by(UserSubscription.plan)
        )
    ).all()
    by_plan = {p: 0 for p in ("free", "student", "pro", "team", "founder")}
    for plan, cnt in plan_rows:
        by_plan[plan] = cnt
    # Users with no subscription row count as free.
    subbed = sum(cnt for _, cnt in plan_rows)
    by_plan["free"] += max(0, total_users - subbed)

    active_subs = (
        await db.execute(
            select(func.count()).select_from(UserSubscription).where(
                UserSubscription.plan != "free",
                UserSubscription.status == "active",
            )
        )
    ).scalar_one()
    expired_subs = (
        await db.execute(
            select(func.count()).select_from(UserSubscription).where(
                UserSubscription.status.in_(("expired", "canceled", "past_due"))
            )
        )
    ).scalar_one()
    trial_users = (
        await db.execute(
            select(func.count()).select_from(UserSubscription).where(
                UserSubscription.status == "trialing"
            )
        )
    ).scalar_one()

    todays_signups = (
        await db.execute(
            select(func.count()).select_from(User).where(User.created_at >= today_start)
        )
    ).scalar_one()

    monthly_revenue_paise = (
        await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.status == "captured", Payment.purchase_date >= month_start
            )
        )
    ).scalar_one()

    recent_pay_rows = (
        await db.execute(
            select(Payment, User.email)
            .join(User, User.id == Payment.user_id, isouter=True)
            .order_by(Payment.purchase_date.desc())
            .limit(10)
        )
    ).all()
    recent_payments = [
        {
            "payment_id": p.payment_id, "email": email, "amount": p.amount,
            "amount_display": f"₹{p.amount / 100:,.0f}",
            "currency": p.currency, "status": p.status, "plan": p.plan_name,
            "date": p.purchase_date.isoformat(),
        }
        for p, email in recent_pay_rows
    ]

    return {
        "total_users": total_users,
        "free_users": by_plan["free"],
        "student_users": by_plan["student"],
        "pro_users": by_plan["pro"],
        "team_users": by_plan["team"],
        "founder_users": by_plan["founder"],
        "active_subscriptions": active_subs,
        "expired_subscriptions": expired_subs,
        "trial_users": trial_users,
        "todays_signups": todays_signups,
        "monthly_revenue": monthly_revenue_paise,
        "monthly_revenue_display": f"₹{monthly_revenue_paise / 100:,.0f}",
        "recent_payments": recent_payments,
    }


# ── Category user lists (clickable dashboard cards) ──────────────────────────

# Category keys the dashboard cards drill into. Definitions mirror the
# aggregate counts in dashboard_stats() EXACTLY so a card's number always
# equals the row count of the list it opens.
USER_CATEGORIES = (
    "total", "free", "student", "pro", "team", "founder",
    "active", "expired", "trial", "today",
)

USER_SORT_KEYS = ("signup_date", "last_active", "plan", "email")


def _apply_category(stmt, category: str):
    """Add the WHERE clauses for one dashboard category. `stmt` must already
    have User outer-joined to UserSubscription."""
    now = datetime.now(timezone.utc)
    if category == "total":
        return stmt
    if category == "free":
        # No subscription row counts as free — same as dashboard_stats.
        return stmt.where(or_(
            UserSubscription.id.is_(None), UserSubscription.plan == "free",
        ))
    if category in ("student", "pro", "team", "founder"):
        return stmt.where(UserSubscription.plan == category)
    if category == "active":
        return stmt.where(
            UserSubscription.plan != "free", UserSubscription.status == "active",
        )
    if category == "expired":
        return stmt.where(
            UserSubscription.status.in_(("expired", "canceled", "past_due"))
        )
    if category == "trial":
        return stmt.where(UserSubscription.status == "trialing")
    if category == "today":
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return stmt.where(User.created_at >= today_start)
    raise ValueError(f"Unknown user category '{category}'.")


async def list_users_by_category(
    db: AsyncSession, *, category: str = "total", q: str = "",
    sort_by: str = "signup_date", sort_dir: str = "desc",
    limit: int = 50, offset: int = 0,
) -> dict:
    """Users matching one dashboard category, searchable / sortable / paged.

    last_active = most recent AI-tool session (sessions.last_used), falling
    back to the user row's updated_at — the best activity signals currently
    stored. Platforms come from active device_tokens rows for the returned
    page only, so the main query stays a single indexed join.
    """
    if category not in USER_CATEGORIES:
        raise ValueError(f"Unknown user category '{category}'.")
    if sort_by not in USER_SORT_KEYS:
        raise ValueError(f"Unsupported sort key '{sort_by}'.")

    # Per-user last tool activity, joined as an aggregate subquery (one scan
    # of sessions instead of a correlated subquery per row).
    last_seen = (
        select(AISession.user_id, func.max(AISession.last_used).label("last_used"))
        .group_by(AISession.user_id)
        .subquery()
    )

    plan_expr = func.coalesce(UserSubscription.plan, "free")
    last_active_expr = func.coalesce(last_seen.c.last_used, User.updated_at)

    base = (
        select(User, UserSubscription, last_seen.c.last_used)
        .join(UserSubscription, UserSubscription.user_id == User.id, isouter=True)
        .join(last_seen, last_seen.c.user_id == User.id, isouter=True)
    )
    base = _apply_category(base, category)

    term = (q or "").strip()
    if term:
        like = f"%{term.lower()}%"
        base = base.where(or_(
            func.lower(User.email).like(like),
            func.lower(User.name).like(like),
            User.id == term,
        ))

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    order_col = {
        "signup_date": User.created_at,
        "last_active": last_active_expr,
        "plan": plan_expr,
        "email": func.lower(User.email),
    }[sort_by]
    ordered = base.order_by(
        order_col.asc() if sort_dir == "asc" else order_col.desc(),
        User.created_at.desc(),  # stable tie-break so pagination never skips rows
    )

    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    rows = (await db.execute(ordered.limit(limit).offset(offset))).all()

    # Platforms for just this page of users — one IN query, merged in Python.
    user_ids = [u.id for u, _s, _la in rows]
    platforms: dict[str, list[str]] = {}
    if user_ids:
        tok_rows = (
            await db.execute(
                select(DeviceToken.user_id, DeviceToken.platform)
                .where(DeviceToken.user_id.in_(user_ids), DeviceToken.active.is_(True))
                .distinct()
            )
        ).all()
        for uid, platform in tok_rows:
            platforms.setdefault(uid, []).append(platform)

    users = []
    for u, s, last_used in rows:
        last_active = _aware(last_used) or _aware(u.updated_at)
        users.append({
            "user_id": u.id,
            "email": u.email,
            "name": u.name,
            "plan": (s.plan if s else "free"),
            "status": (s.status if s else "active"),
            "signup_date": u.created_at.isoformat(),
            "last_active": last_active.isoformat() if last_active else None,
            "expiry": (s.current_period_end.isoformat() if s and s.current_period_end else None),
            "platforms": sorted(platforms.get(u.id, [])),
        })

    return {
        "category": category, "q": term, "sort_by": sort_by,
        "sort_dir": "asc" if sort_dir == "asc" else "desc",
        "total": total, "limit": limit, "offset": offset, "users": users,
    }
