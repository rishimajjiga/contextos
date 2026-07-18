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
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.founder import FounderActivityLog, ManualGrant
from app.models.payment import Payment
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
        "todays_signups": todays_signups,
        "monthly_revenue": monthly_revenue_paise,
        "monthly_revenue_display": f"₹{monthly_revenue_paise / 100:,.0f}",
        "recent_payments": recent_payments,
    }
