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
    # api_keys: 2 on free so one device/client can hold each of a mobile key AND a Chrome
    # extension key at the same time (the free plan's two supported clients), instead of them
    # fighting over a single slot.
    "free":    {"projects": 1,  "memories": 10, "api_keys": 2,  "daily_inject": 3},
    "student": {"projects": 5,  "memories": 200, "api_keys": 1,  "daily_inject": -1},
    "pro":     {"projects": -1, "memories": -1, "api_keys": 5,  "daily_inject": -1},
    "team":    {"projects": -1, "memories": -1, "api_keys": -1, "daily_inject": -1},
    # Internal-only lifetime plan — everything unlimited. Never exposed on
    # pricing pages or selectable by users (see PUBLIC_PLANS / billing.get_plans).
    "founder": {"projects": -1, "memories": -1, "api_keys": -1, "daily_inject": -1},
}

PLAN_DISPLAY = {"free": "Free", "student": "Student", "pro": "Pro", "team": "Team", "founder": "Founder"}

# Plans that are publicly visible / selectable. "founder" is intentionally excluded.
PUBLIC_PLANS = ("free", "student", "pro", "team")

GRACE_PERIOD_DAYS = 30


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    """Coerce a DB datetime to UTC-aware (SQLite test DB returns naive)."""
    if dt is None:
        return None
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def preserve_offer_window(sub) -> None:
    """While the New Member Offer's free months are in progress, the access
    window must end at offer_end_date — not at Razorpay's 1-month current_end.

    Razorpay webhooks (subscription.activated / subscription.charged) and the
    recovery paths all copy current_end onto current_period_end. They can land
    AFTER /verify applied the offer, which would silently shrink the user's
    3-month access window back to the paid month. Call this after any such
    write to keep the offer window authoritative.
    """
    if not bool(getattr(sub, "offer_applied", False)):
        return
    offer_end = _aware(getattr(sub, "offer_end_date", None))
    if offer_end is None:
        return
    cpe = _aware(sub.current_period_end)
    if cpe is None or cpe < offer_end:
        sub.current_period_end = offer_end


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


async def _is_founder(db: AsyncSession, user_id: str) -> bool:
    """True if this user's email is a configured founder account."""
    from app.config import settings
    from app.models.user import User
    founders = settings.founder_emails
    if not founders:
        return False
    result = await db.execute(select(User.email).where(User.id == user_id))
    email = result.scalar_one_or_none()
    return bool(email) and email.strip().lower() in founders


async def _get_personal_plan(db: AsyncSession, user_id: str) -> str:
    """The user's OWN plan (founder/team/pro/student/free), ignoring any
    organization inheritance. Used internally; callers use get_user_plan()."""
    sub = await get_or_create_subscription(db, user_id)

    # Founder accounts: lifetime full access, granted automatically by email.
    # No upgrade, no payment, no trial, no expiration. Persisted to the DB so
    # the grant survives and all downstream limit checks treat them as unlimited.
    if await _is_founder(db, user_id):
        if (sub.plan != "founder" or sub.status != "active"
                or sub.current_period_end is not None or sub.grace_period_end is not None):
            sub.plan = "founder"            # plan = "founder"
            sub.status = "active"           # subscription_active = true
            sub.current_period_end = None   # expires_at = null
            sub.grace_period_end = None
            await db.commit()
            log.info("founder_access_granted", user_id=user_id)
        return "founder"

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


async def _org_owner_personal_plan(db: AsyncSession, user_id: str) -> str | None:
    """If the user is a MEMBER of an organization they don't own, return the
    org owner's personal plan; otherwise None. Used for team-plan inheritance."""
    from app.models.organization import Organization, OrganizationMember
    result = await db.execute(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
        .where(OrganizationMember.user_id == user_id)
        .limit(1)
    )
    org = result.scalar_one_or_none()
    if org is None or org.owner_user_id == user_id:
        return None
    return await _get_personal_plan(db, org.owner_user_id)


async def get_user_plan(db: AsyncSession, user_id: str) -> str:
    """Effective plan. Organizations own the subscription: a member of an org
    whose OWNER has an active Team (or founder) plan inherits 'team', even if
    their personal plan is free. Owner/founder keep their own plan."""
    personal = await _get_personal_plan(db, user_id)
    if personal in ("team", "founder"):
        return personal
    owner_plan = await _org_owner_personal_plan(db, user_id)
    if owner_plan in ("team", "founder"):
        return "team"
    return personal


async def is_in_grace_period(db: AsyncSession, user_id: str) -> bool:
    sub = await get_or_create_subscription(db, user_id)
    if sub.grace_period_end is None:
        return False
    return datetime.now(timezone.utc) < sub.grace_period_end


async def get_plan_info(db: AsyncSession, user_id: str) -> dict:
    sub = await get_or_create_subscription(db, user_id)

    # ── Self-healing: fix stale grace/expired state for users who already paid ──
    # If grace_period_end is set but a successful payment exists, the user paid
    # and the old verify_payment didn't clear it. Auto-fix on every plan fetch
    # so existing stuck users recover the moment they open the app.
    if sub.grace_period_end is not None:
        from app.models.payment import Payment
        from sqlalchemy import desc as _desc
        try:
            recent_pay = await db.execute(
                select(Payment)
                .where(Payment.user_id == user_id, Payment.status == "captured")
                .order_by(_desc(Payment.purchase_date))
                .limit(1)
            )
            latest = recent_pay.scalar_one_or_none()
            if latest is not None:
                # Payment exists — the grace period is stale; clear it now
                log.info(
                    "subscription_self_heal",
                    user_id=user_id,
                    payment_id=latest.payment_id,
                    plan=latest.plan_name,
                )
                sub.plan = latest.plan_name
                sub.status = "active"
                sub.grace_period_end = None
                sub.backup_sent = False
                sub.auto_renew = True
                if sub.started_at is None:
                    sub.started_at = latest.purchase_date
                await db.commit()
        except Exception as exc:
            log.warning("subscription_self_heal_failed", user_id=user_id, error=str(exc))
    # ── end self-healing ──────────────────────────────────────────────────────

    plan = await get_user_plan(db, user_id)
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    now = datetime.now(timezone.utc)
    in_grace = sub.grace_period_end is not None and now < sub.grace_period_end

    # True when the user's one-time Student trial has been used and has since
    # ended (they are back on free, not in a paid plan, not in grace). Drives the
    # proactive "your trial ended — upgrade" prompt on the frontend. Note: by the
    # time this runs, an expired trial has already been lazily downgraded to
    # free by get_user_plan() above, so we rely on trial_used + free plan.
    trial_expired = (
        plan == "free"
        and bool(getattr(sub, "trial_used", False))
        and not in_grace
        and sub.status != "trialing"
    )

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

    # Calculate days remaining in current billing period
    days_remaining = None
    if sub.current_period_end and sub.current_period_end > now:
        delta = sub.current_period_end - now
        days_remaining = delta.days

    # ── New Member Offer status (first monthly Pro subscription) ─────────────
    offer_started = getattr(sub, "offer_started_at", None)
    offer_end = getattr(sub, "offer_end_date", None)
    offer_active = bool(
        plan == "pro" and offer_end is not None and now < offer_end
    )
    # Whole free months still ahead of `now` inside the offer window (0-2)
    offer_free_months_remaining = 0
    if offer_active and offer_started is not None:
        elapsed_days = (now - offer_started).days
        offer_free_months_remaining = max(0, min(2, 2 - max(0, (elapsed_days - 30) // 30 + 1)))
        if elapsed_days < 30:
            offer_free_months_remaining = 2

    # The user's next charge: end of the offer window while it's active,
    # otherwise the normal period end (only when auto-renew is on).
    if offer_active:
        next_payment_date = offer_end
    elif sub.auto_renew and plan not in ("free", "founder") and sub.status == "active":
        next_payment_date = sub.current_period_end
    else:
        next_payment_date = None

    return {
        "plan": plan,
        "display_name": PLAN_DISPLAY.get(plan, plan.title()),
        "limits": limits,
        "status": sub.status,
        "current_period_end": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "is_trialing": sub.status == "trialing",
        "trial_expired": trial_expired,
        "is_in_grace_period": in_grace,
        "grace_period_end": sub.grace_period_end.isoformat() if sub.grace_period_end else None,
        "usage": {"projects": proj_count, "memories": mem_count},
        # Enhanced billing details (Task B/C)
        "started_on": sub.started_at.isoformat() if sub.started_at else None,
        "auto_renew": bool(sub.auto_renew),
        "days_remaining": days_remaining,
        # New Member Offer (first monthly Pro subscription — one-time)
        "offer": {
            "used": bool(getattr(sub, "offer_used", False)),
            "active": offer_active,
            "started_at": offer_started.isoformat() if offer_started else None,
            "end_date": offer_end.isoformat() if offer_end else None,
            "free_months": int(getattr(sub, "offer_free_months", 0) or 0),
            "bonus_months": int(getattr(sub, "offer_free_months", 0) or 0),
            "free_months_remaining": offer_free_months_remaining,
        },
        "next_payment_date": next_payment_date.isoformat() if next_payment_date else None,
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
                    "You have reached the API key limit for the Student Plan."
                    if plan == "student"
                    else (
                        f"You've reached the {limit} API key limit on the {PLAN_DISPLAY[plan]} plan. "
                        "Upgrade to Pro for more API keys."
                    )
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
    now = datetime.now(timezone.utc)
    sub.stripe_subscription_id = rzp_sub_id
    sub.plan = plan
    sub.status = "active"
    sub.grace_period_end = None   # clear any stale grace/expired state
    sub.backup_sent = False
    sub.auto_renew = True
    if sub.started_at is None:
        sub.started_at = now
    if current_end_ts:
        sub.current_period_end = datetime.fromtimestamp(current_end_ts, tz=timezone.utc)
    # Never let the webhook shrink an in-progress offer window (webhook can
    # arrive after /verify already extended access by the 2 bonus months).
    preserve_offer_window(sub)
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
    sub.auto_renew = True
    if current_end_ts:
        sub.current_period_end = datetime.fromtimestamp(current_end_ts, tz=timezone.utc)

    now = datetime.now(timezone.utc)
    offer_end = _aware(getattr(sub, "offer_end_date", None))
    if bool(getattr(sub, "offer_applied", False)) and offer_end is not None:
        if now >= offer_end:
            # A real charge at/after the offer end means recurring ₹499/month
            # billing has resumed — the free period is over.
            sub.offer_applied = False
        else:
            # Charge webhook for month 1 racing with /verify — keep the
            # 3-month offer access window intact.
            preserve_offer_window(sub)
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
