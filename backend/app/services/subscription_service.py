"""
app/services/subscription_service.py
Plan limits enforcement and subscription helpers.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import UserSubscription
from app.models.document import Document
from app.models.project import Project

# ── Plan limits ───────────────────────────────────────────────────────────────
# -1 = unlimited

PLAN_LIMITS = {
    "free": {
        "documents": 10,
        "projects":  1,
        "api_keys":  1,
        "daily_inject": 3,
    },
    "student": {
        "documents": 100,
        "projects":  3,
        "api_keys":  3,
        "daily_inject": -1,
    },
    "pro": {
        "documents": 500,
        "projects":  -1,
        "api_keys":  5,
        "daily_inject": -1,
    },
    "team": {
        "documents": -1,
        "projects":  -1,
        "api_keys":  -1,
        "daily_inject": -1,
    },
}

PLAN_DISPLAY = {
    "free":    "Free",
    "student": "Student",
    "pro":     "Pro",
    "team":    "Team",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def get_or_create_subscription(db: AsyncSession, user_id: str) -> UserSubscription:
    """Return the user's subscription row, creating a free one if absent."""
    result = await db.execute(
        select(UserSubscription).where(UserSubscription.user_id == user_id)
    )
    sub = result.scalar_one_or_none()
    if sub is None:
        sub = UserSubscription(user_id=user_id, plan="free", status="active")
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
    return sub


async def get_user_plan(db: AsyncSession, user_id: str) -> str:
    """Return the user's current plan name."""
    sub = await get_or_create_subscription(db, user_id)
    now = datetime.now(timezone.utc)

    # Trial ended — downgrade to free
    if sub.status == "trialing" and sub.current_period_end and sub.current_period_end < now:
        sub.plan = "free"
        sub.status = "active"
        sub.current_period_end = None
        await db.commit()
        return "free"

    # Canceled / past_due and period ended — downgrade to free
    if sub.plan != "free" and sub.status in ("canceled", "past_due"):
        if sub.current_period_end and sub.current_period_end < now:
            sub.plan = "free"
            sub.status = "active"
            await db.commit()

    return sub.plan


async def get_plan_info(db: AsyncSession, user_id: str) -> dict:
    """Return plan info + current usage counts for the dashboard."""
    sub = await get_or_create_subscription(db, user_id)
    plan = await get_user_plan(db, user_id)
    limits = PLAN_LIMITS[plan]

    doc_count_result = await db.execute(
        select(func.count()).where(Document.user_id == user_id)
    )
    doc_count = doc_count_result.scalar_one()

    proj_count_result = await db.execute(
        select(func.count()).where(Project.user_id == user_id)
    )
    proj_count = proj_count_result.scalar_one()

    return {
        "plan": plan,
        "display_name": PLAN_DISPLAY[plan],
        "limits": limits,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "is_trialing": sub.status == "trialing",
        "usage": {
            "documents": doc_count,
            "projects":  proj_count,
        },
    }


# ── Limit checks ──────────────────────────────────────────────────────────────

async def check_document_limit(db: AsyncSession, user_id: str) -> None:
    """Raise 402 if the user is at their document limit."""
    plan = await get_user_plan(db, user_id)
    limit = PLAN_LIMITS[plan]["documents"]
    if limit == -1:
        return  # unlimited

    result = await db.execute(
        select(func.count()).where(Document.user_id == user_id)
    )
    count = result.scalar_one()
    if count >= limit:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "LIMIT_REACHED",
                "resource": "documents",
                "limit": limit,
                "plan": plan,
                "message": (
                    f"You've reached the {limit}-memory limit on the {PLAN_DISPLAY[plan]} plan. "
                    "Upgrade to Pro to store up to 500 memories."
                ),
            },
        )


async def check_project_limit(db: AsyncSession, user_id: str) -> None:
    """Raise 402 if the user is at their project limit."""
    plan = await get_user_plan(db, user_id)
    limit = PLAN_LIMITS[plan]["projects"]
    if limit == -1:
        return  # unlimited

    result = await db.execute(
        select(func.count()).where(Project.user_id == user_id)
    )
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


# ── Razorpay webhook helpers ──────────────────────────────────────────────────

async def handle_razorpay_subscription_activated(db: AsyncSession, payload: dict) -> None:
    """subscription.activated — user's first payment succeeded."""
    rzp_sub = payload.get("subscription", {}).get("entity", {})
    rzp_sub_id = rzp_sub.get("id")
    plan_id = rzp_sub.get("plan_id")
    current_end_ts = rzp_sub.get("current_end")
    notes = rzp_sub.get("notes", {})
    user_id = notes.get("user_id")

    if not user_id:
        return

    # Prefer the plan stored in notes (set by billing endpoint), fall back to plan_id lookup
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
    sub.stripe_subscription_id = rzp_sub_id   # reuse column for Razorpay sub ID
    sub.plan = plan
    sub.status = "active"
    if current_end_ts:
        sub.current_period_end = datetime.fromtimestamp(current_end_ts, tz=timezone.utc)
    await db.commit()


async def handle_razorpay_subscription_charged(db: AsyncSession, payload: dict) -> None:
    """subscription.charged — recurring payment succeeded, extend period."""
    rzp_sub = payload.get("subscription", {}).get("entity", {})
    rzp_sub_id = rzp_sub.get("id")
    current_end_ts = rzp_sub.get("current_end")

    result = await db.execute(
        select(UserSubscription).where(
            UserSubscription.stripe_subscription_id == rzp_sub_id
        )
    )
    sub = result.scalar_one_or_none()
    if sub is None:
        return

    sub.status = "active"
    if current_end_ts:
        sub.current_period_end = datetime.fromtimestamp(current_end_ts, tz=timezone.utc)
    await db.commit()


async def handle_razorpay_subscription_cancelled(db: AsyncSession, payload: dict) -> None:
    """subscription.cancelled / completed — downgrade to free."""
    rzp_sub = payload.get("subscription", {}).get("entity", {})
    rzp_sub_id = rzp_sub.get("id")

    result = await db.execute(
        select(UserSubscription).where(
            UserSubscription.stripe_subscription_id == rzp_sub_id
        )
    )
    sub = result.scalar_one_or_none()
    if sub is None:
        return

    sub.plan = "free"
    sub.status = "active"
    sub.stripe_subscription_id = None
    sub.current_period_end = None
    await db.commit()
