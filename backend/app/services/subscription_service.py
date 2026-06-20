"""
app/services/subscription_service.py
Plan limits enforcement, subscription helpers, grace period logic.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from fastapi import HTTPException, status
from sqlalchemy import delete as sql_delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserSubscription
from app.models.project import Project
from app.models.document import Document

log = structlog.get_logger()

# -1 = unlimited
PLAN_LIMITS = {
    "free":    {"projects": 1,  "memories": 10, "api_keys": 1,  "daily_inject": 3},
    "student": {"projects": 3,  "memories": -1, "api_keys": 3,  "daily_inject": -1},
    "pro":     {"projects": -1, "memories": -1, "api_keys": 5,  "daily_inject": -1},
    "team":    {"projects": -1, "memories": -1, "api_keys": -1, "daily_inject": -1},
}

PLAN_DISPLAY = {"free": "Free", "student": "Student", "pro": "Pro", "team": "Team"}

GRACE_PERIOD_DAYS = 30


async def get_or_create_subscription(db: AsyncSession, user_id: str) -> UserSubscription:
    """
    Returns the subscription row, creating a free-plan row on first call.
    Race-condition safe: IntegrityError from concurrent INSERT is caught and
    re-fetched so the caller always gets a valid row.
    """
    result = await db.execute(
        select(UserSubscription).where(UserSubscription.user_id == user_id)
    )
    sub = result.scalar_one_or_none()
    if sub is not None:
        return sub

    try:
        sub = UserSubscription(user_id=user_id, plan="free", status="active")
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
        log.info("subscription_created", user_id=user_id, plan="free")
        return sub
    except IntegrityError:
        await db.rollback()
        log.debug("subscription_race_condition_resolved", user_id=user_id)
        result = await db.execute(
            select(UserSubscription).where(UserSubscription.user_id == user_id)
        )
        sub = result.scalar_one_or_none()
        if sub is None:
            log.error("subscription_missing_after_race_retry", user_id=user_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Could not create your account record. Please try again.",
            )
        return sub


async def get_user_plan(db: AsyncSession, user_id: str) -> str:
    sub = await get_or_create_subscription(db, user_id)
    now = datetime.now(timezone.utc)

    if sub.status == "trialing" and sub.current_period_end and sub.current_period_end < now:
        sub.plan = "free"
        sub.status = "active"
        sub.current_period_end = None
        await db.commit()
        return "free"

    if sub.plan != "free" and sub.status in ("canceled", "past_due"):
        if sub.current_period_end and sub.current_period_end < now:
            if not sub.grace_period_end:
                sub.grace_period_end = now + timedelta(days=GRACE_PERIOD_DAYS)
                await db.commit()
            return "free"

    plan = sub.plan
    if plan not in PLAN_LIMITS:
        log.warning("unknown_plan_in_db", user_id=user_id, plan_value=plan)
        sub.plan = "free"
        await db.commit()
        return "free"
    return plan


async def is_in_grace_period(db: AsyncSession, user_id: str) -> bool:
    sub = await get_or_create_subscription(db, user_id)
    if sub.grace_period_end is None:
        return False
    return datetime.now(timezone.utc) < sub.grace_period_end


async def get_plan_info(db: AsyncSession, user_id: str) -> dict:
    sub = await get_or_create_subscription(db, user_id)
    plan = await get_user_plan(db, user_id)
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    now = datetime.now(timezone.utc)
    in_grace = sub.grace_period_end is not None and now < sub.grace_period_end

    try:
        r = await db.execute(select(func.count()).where(Project.user_id == user_id))
        proj_count = r.scalar_one()
    except Exception as exc:
        log.error("get_plan_info_proj_count_failed", user_id=user_id, error=str(exc))
        proj_count = 0

    try:
        r = await db.execute(
            select(func.count()).where(
                Document.user_id == user_id, Document.doc_type == "note"
            )
        )
        mem_count = r.scalar_one()
    except Exception as exc:
        log.error("get_plan_info_mem_count_failed", user_id=user_id, error=str(exc))
        mem_count = 0

    return {
        "plan": plan,
        "display_name": PLAN_DISPLAY.get(plan, plan.title()),
        "limits": limits,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "is_trialing": sub.status == "trialing",
        "is_in_grace_period": in_grace,
        "grace_period_end": sub.grace_period_end.isoformat() if sub.grace_period_end else None,
        "usage": {"projects": proj_count, "memories": mem_count},
    }


async def _delete_all_user_data(db: AsyncSession, user_id: str) -> None:
    from app.models.api_key import ApiKey
    await db.execute(sql_delete(ApiKey).where(ApiKey.user_id == user_id))
    await db.execute(sql_delete(Document).where(Document.user_id == user_id))
    await db.execute(sql_delete(Project).where(Project.user_id == user_id))
    await db.commit()


async def purge_if_grace_expired(db: AsyncSession, user_id: str) -> bool:
    sub = await get_or_create_subscription(db, user_id)
    if sub.grace_period_end is None:
        return False
    now = datetime.now(timezone.utc)
    if now < sub.grace_period_end:
        return False
    await _delete_all_user_data(db, user_id)
    sub.plan = "free"
    sub.status = "expired"
    sub.grace_period_end = None
    await db.commit()
    return True


async def _check_grace_period_write(db: AsyncSession, user_id: str) -> None:
    in_grace = await is_in_grace_period(db, user_id)
    if in_grace:
        sub = await get_or_create_subscription(db, user_id)
        days_left = 0
        if sub.grace_period_end:
            delta = sub.grace_period_end - datetime.now(timezone.utc)
            days_left = max(0, delta.days)
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "GRACE_PERIOD",
                "resource": "subscription",
                "days_left": days_left,
                "message": (
                    f"Your subscription has expired. Your data is read-only for "
                    f"{days_left} more day(s). Download your data or renew to keep it."
                ),
            },
        )


async def check_project_limit(db: AsyncSession, user_id: str) -> None:
    await _check_grace_period_write(db, user_id)
    plan = await get_user_plan(db, user_id)
    limit = PLAN_LIMITS[plan]["projects"]
    if limit == -1:
        return
    result = await db.execute(select(func.count()).where(Project.user_id == user_id))
    count = result.scalar_one()
    if count >= limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "LIMIT_REACHED",
                "resource": "projects",
                "limit": limit,
                "plan": plan,
                "message": (
                    f"You've reached the {limit}-project limit on the {PLAN_DISPLAY[plan]} plan. "
                    "Upgrade to Pro for unlimited projects."
                ),
            },
        )


async def check_memory_limit(db: AsyncSession, user_id: str) -> None:
    await _check_grace_period_write(db, user_id)
    plan = await get_user_plan(db, user_id)
    limit = PLAN_LIMITS[plan]["memories"]
    if limit == -1:
        return
    result = await db.execute(
        select(func.count()).where(
            Document.user_id == user_id, Document.doc_type == "note"
        )
    )
    count = result.scalar_one()
    if count >= limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "LIMIT_REACHED",
                "resource": "memories",
                "limit": limit,
                "plan": plan,
                "message": (
                    f"You've reached the {limit}-memory limit on the {PLAN_DISPLAY[plan]} plan. "
                    "Upgrade to Pro for unlimited memories."
                ),
            },
        )


async def check_api_key_limit(db: AsyncSession, user_id: str) -> None:
    from app.models.api_key import ApiKey
    plan = await get_user_plan(db, user_id)
    limit = PLAN_LIMITS[plan]["api_keys"]
    if limit == -1:
        return
    result = await db.execute(select(func.count()).where(ApiKey.user_id == user_id))
    count = result.scalar_one()
    if count >= limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "LIMIT_REACHED",
                "resource": "api_keys",
                "limit": limit,
                "plan": plan,
                "message": (
                    f"You've reached the {limit} API key limit on the {PLAN_DISPLAY[plan]} plan. "
                    "Upgrade to Pro for more API keys."
                ),
            },
        )


async def handle_razorpay_subscription_activated(db: AsyncSession, payload: dict) -> None:
    rzp_sub = payload.get("subscription", {}).get("entity", {})
    rzp_sub_id = rzp_sub.get("id")
    plan_id = rzp_sub.get("plan_id")
    current_end_ts = rzp_sub.get("current_end")
    notes = rzp_sub.get("notes", {})
    user_id = notes.get("user_id")
    if not user_id:
        return
    plan = notes.get("plan", "free")
    if plan not in PLAN_LIMITS:
        from app.config import settings
        if plan_id in (settings.razorpay_pro_plan_id, settings.razorpay_pro_annual_plan_id):
            plan = "pro"
        elif plan_id in (settings.razorpay_team_plan_id, settings.razorpay_team_annual_plan_id):
            plan = "team"
        elif plan_id == settings.razorpay_student_plan_id:
            plan = "student"
        else:
            plan = "free"
    sub = await get_or_create_subscription(db, user_id)
    sub.stripe_subscription_id = rzp_sub_id
    sub.plan = plan
    sub.status = "active"
    sub.grace_period_end = None
    sub.backup_sent = False
    if current_end_ts:
        sub.current_period_end = datetime.fromtimestamp(current_end_ts, tz=timezone.utc)
    await db.commit()


async def handle_razorpay_subscription_charged(db: AsyncSession, payload: dict) -> None:
    rzp_sub = payload.get("subscription", {}).get("entity", {})
    rzp_sub_id = rzp_sub.get("id")
    current_end_ts = rzp_sub.get("current_end")
    result = await db.execute(
        select(UserSubscription).where(UserSubscription.stripe_subscription_id == rzp_sub_id)
    )
    sub = result.scalar_one_or_none()
    if sub is None:
        return
    sub.status = "active"
    sub.grace_period_end = None
    sub.backup_sent = False
    if current_end_ts:
        sub.current_period_end = datetime.fromtimestamp(current_end_ts, tz=timezone.utc)
    await db.commit()


async def handle_razorpay_subscription_cancelled(db: AsyncSession, payload: dict) -> None:
    rzp_sub = payload.get("subscription", {}).get("entity", {})
    rzp_sub_id = rzp_sub.get("id")
    result = await db.execute(
        select(UserSubscription).where(UserSubscription.stripe_subscription_id == rzp_sub_id)
    )
    sub = result.scalar_one_or_none()
    if sub is None:
        return
    now = datetime.now(timezone.utc)
    sub.status = "canceled"
    if not sub.grace_period_end:
        sub.grace_period_end = now + timedelta(days=GRACE_PERIOD_DAYS)
    await db.commit()
