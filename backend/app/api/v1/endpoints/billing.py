"""
app/api/v1/endpoints/billing.py
Razorpay billing — subscription creation, payment verification, webhook, plan info.

Flow:
  1. Frontend calls POST /billing/subscribe  → backend creates Razorpay subscription
  2. Backend returns {subscription_id, key_id} to frontend
  3. Frontend opens Razorpay JS modal with those values
  4. User pays → Razorpay calls POST /billing/webhook (no auth)
  5. Backend verifies HMAC signature and activates the plan
"""
import hashlib
import hmac
from datetime import datetime, timezone
# Python 3.12+ compatibility shim: razorpay uses pkg_resources which is not
# bundled with Python 3.12+. Inject a minimal stub before importing razorpay.
try:
    import pkg_resources  # noqa: F401
except ModuleNotFoundError:
    import sys as _sys
    import types as _types
    _pkg = _types.ModuleType("pkg_resources")
    class _DistributionNotFound(Exception): pass
    _pkg.DistributionNotFound = _DistributionNotFound
    _pkg.get_distribution = lambda name: type("D", (), {"version": "0.0.0"})()
    _sys.modules["pkg_resources"] = _pkg

import razorpay
import structlog

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

import httpx

from app.config import settings
from app.database import get_db
from app.api.v1.dependencies import get_user_id, get_user_id_no_purge
from app.middleware import get_current_user_id
from app.services.subscription_service import (
    get_or_create_subscription,
    get_plan_info,
    handle_razorpay_subscription_activated,
    handle_razorpay_subscription_charged,
    handle_razorpay_subscription_cancelled,
)

log = structlog.get_logger()
router = APIRouter()


def _rzp_client() -> razorpay.Client:
    return razorpay.Client(
        auth=(settings.razorpay_key_id, settings.razorpay_key_secret)
    )


# ── Schemas ───────────────────────────────────────────────────────────────────

class SubscribeRequest(BaseModel):
    plan: str   # "pro" | "team"


class SubscribeResponse(BaseModel):
    subscription_id: str
    key_id: str


class VerifyRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_subscription_id: str
    razorpay_signature: str


class CancelRequest(BaseModel):
    cancel_at_cycle_end: bool = True


# ── GET /billing/plan ─────────────────────────────────────────────────────────

@router.get("/plan")
async def get_plan(
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the user's current plan, limits, and usage counts."""
    try:
        return await get_plan_info(db, user_id)
    except HTTPException:
        raise
    except Exception as exc:
        log.error(
            "billing_get_plan_unexpected_error",
            user_id=user_id,
            error=str(exc),
            error_type=type(exc).__name__,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load your billing plan: {exc}",
        )


# ── POST /billing/subscribe ───────────────────────────────────────────────────

@router.post("/subscribe", response_model=SubscribeResponse)
async def create_subscription(
    body: SubscribeRequest,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a Razorpay subscription and returns the subscription_id + key_id.
    The frontend uses these to open the Razorpay JS checkout modal.
    """
    if not settings.razorpay_key_id:
        raise HTTPException(status_code=503, detail="Billing not configured.")

    # Map frontend plan key -> Razorpay plan ID + resolved plan name stored in DB
    plan_map = {
        "pro":         (settings.razorpay_pro_plan_id,         "pro"),
        "pro_annual":  (settings.razorpay_pro_annual_plan_id,  "pro"),
        "team":        (settings.razorpay_team_plan_id,        "team"),
        "team_annual": (settings.razorpay_team_annual_plan_id, "team"),
        "student":     (settings.razorpay_student_plan_id,     "student"),
    }
    entry = plan_map.get(body.plan)
    if not entry:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {body.plan}")
    plan_id, resolved_plan = entry
    if not plan_id:
        raise HTTPException(status_code=400, detail=f"Plan '{body.plan}' not configured yet.")

    # Annual plans: 1 billing cycle per year; monthly: 12 cycles
    total_count = 1 if "annual" in body.plan else 12

    client = _rzp_client()

    try:
        rzp_sub = client.subscription.create({
            "plan_id": plan_id,
            "total_count": total_count,
            "quantity": 1,
            "customer_notify": 1,
            "notes": {
                "user_id": user_id,
                "plan": resolved_plan,
            },
        })
    except Exception as e:
        log.error("razorpay_subscribe_error", user_id=user_id, error=str(e))
        raise HTTPException(status_code=502, detail=f"Razorpay error: {e}")

    # Store the subscription ID immediately (status = created, not yet active)
    sub = await get_or_create_subscription(db, user_id)
    sub.stripe_subscription_id = rzp_sub["id"]   # reusing column for Razorpay sub ID
    await db.commit()

    return SubscribeResponse(
        subscription_id=rzp_sub["id"],
        key_id=settings.razorpay_key_id,
    )


# ── POST /billing/verify ──────────────────────────────────────────────────────

@router.post("/verify")
async def verify_payment(
    body: VerifyRequest,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Called by the frontend after the Razorpay modal succeeds.
    Verifies the HMAC signature and marks the subscription as active.
    """
    # Razorpay signature = HMAC-SHA256(payment_id + "|" + subscription_id, key_secret)
    expected = hmac.new(
        settings.razorpay_key_secret.encode(),
        f"{body.razorpay_payment_id}|{body.razorpay_subscription_id}".encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, body.razorpay_signature):
        raise HTTPException(status_code=400, detail="Invalid payment signature.")

    # Fetch the subscription from Razorpay to read the plan stored in notes
    client = _rzp_client()
    try:
        rzp_sub = client.subscription.fetch(body.razorpay_subscription_id)
    except Exception as e:
        log.error("razorpay_verify_fetch_error", user_id=user_id, error=str(e))
        rzp_sub = {}

    notes = rzp_sub.get("notes", {})
    resolved_plan = notes.get("plan", "")
    plan_id = rzp_sub.get("plan_id", "")
    current_end_ts = rzp_sub.get("current_end")

    # Fall back to plan_id lookup if notes didn't carry the plan
    if resolved_plan not in ("pro", "student", "team"):
        if plan_id in (settings.razorpay_pro_plan_id, settings.razorpay_pro_annual_plan_id):
            resolved_plan = "pro"
        elif plan_id in (settings.razorpay_team_plan_id, settings.razorpay_team_annual_plan_id):
            resolved_plan = "team"
        elif plan_id == settings.razorpay_student_plan_id:
            resolved_plan = "student"
        else:
            resolved_plan = "pro"   # safe default — user just paid

    # Activate the subscription with the correct plan
    sub = await get_or_create_subscription(db, user_id)
    sub.plan = resolved_plan
    sub.status = "active"
    sub.stripe_subscription_id = body.razorpay_subscription_id
    if current_end_ts:
        from datetime import timezone as _tz
        sub.current_period_end = datetime.fromtimestamp(current_end_ts, tz=_tz.utc)
    await db.commit()

    return {"ok": True, "plan": sub.plan}


# ── POST /billing/cancel ──────────────────────────────────────────────────────

@router.post("/cancel")
async def cancel_subscription(
    body: CancelRequest,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Cancel the user's Razorpay subscription."""
    sub = await get_or_create_subscription(db, user_id)
    if not sub.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No active subscription found.")

    client = _rzp_client()
    try:
        client.subscription.cancel(
            sub.stripe_subscription_id,
            {"cancel_at_cycle_end": 1 if body.cancel_at_cycle_end else 0},
        )
    except Exception as e:
        log.error("razorpay_cancel_error", user_id=user_id, error=str(e))
        raise HTTPException(status_code=502, detail=f"Razorpay error: {e}")

    if not body.cancel_at_cycle_end:
        sub.plan = "free"
        sub.status = "active"
        sub.stripe_subscription_id = None
        sub.current_period_end = None
        await db.commit()

    return {"ok": True, "cancel_at_cycle_end": body.cancel_at_cycle_end}


# ── Student email OTP verification ───────────────────────────────────────────
# Domain restrictions (.edu / .ac.in) are removed. Eligibility is now proven
# solely by ownership: the user receives a 6-digit OTP at the address they
# enter and must supply it back to activate the trial.

from app.services.email_service import (
    generate_and_store_otp,
    verify_otp as _verify_otp,
    send_otp_email,
)


class StudentOtpSendRequest(BaseModel):
    email: str  # institutional email the user wants to verify


class StudentOtpVerifyRequest(BaseModel):
    email: str
    otp: str   # 6-digit code from the verification email


# ── POST /billing/student-otp-send ───────────────────────────────────────────

@router.post("/student-otp-send")
async def student_otp_send(
    body: StudentOtpSendRequest,
    user_id: str = Depends(get_user_id),
):
    """
    Send a 6-digit OTP to the supplied email address.
    Any email is accepted — verification proves ownership, not domain membership.
    Rate-limited by slowapi (inherited from the app limiter).
    """
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    # Generate OTP and store it in memory with a 10-minute TTL
    otp = generate_and_store_otp(email, user_id)

    # Send the OTP email; if SMTP is unconfigured the call logs and returns False
    sent = send_otp_email(email, otp)
    if not sent:
        log.error("student_otp_email_not_sent", user_id=user_id, email=email)
        raise HTTPException(
            status_code=503,
            detail="Email service is not configured. Please contact support.",
        )

    log.info("student_otp_sent", user_id=user_id, email=email)
    return {"ok": True, "email": email}


# ── POST /billing/student-verify ─────────────────────────────────────────────

@router.post("/student-verify")
async def student_verify(
    body: StudentOtpVerifyRequest,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Verify the OTP and, if correct, activate a 30-day Student Plan trial.
    The OTP is consumed on success and after too many wrong attempts.
    """
    from datetime import timedelta

    email = body.email.strip().lower()

    # Verify OTP against the in-memory store
    ok, reason = _verify_otp(email, body.otp, user_id)
    if not ok:
        raise HTTPException(status_code=400, detail=reason)

    # Guard against re-activation of an existing trial or active subscription
    sub = await get_or_create_subscription(db, user_id)
    if sub.plan == "student" and sub.status == "trialing":
        raise HTTPException(status_code=400, detail="You already have an active student trial.")
    if sub.plan == "student" and sub.status == "active":
        raise HTTPException(status_code=400, detail="You already have an active student subscription.")

    # Activate the 30-day free trial
    sub.plan = "student"
    sub.status = "trialing"
    sub.current_period_end = datetime.now(timezone.utc) + timedelta(days=30)
    await db.commit()

    log.info("student_trial_activated", user_id=user_id, verified_email=email)
    return {
        "ok": True,
        "trial_ends": sub.current_period_end.isoformat(),
    }


# ── GET /billing/student-check (kept for backward compatibility) ──────────────

@router.get("/student-check")
async def student_check(
    clerk_id: str = Depends(get_current_user_id),
):
    """
    Returns the user's primary Clerk email.
    Domain-based eligibility checks are removed; any email can be verified
    via the OTP flow (/billing/student-otp-send + /billing/student-verify).
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"https://api.clerk.com/v1/users/{clerk_id}",
            headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not fetch your account details.")

    user_data = resp.json()
    email_addresses = user_data.get("email_addresses", [])
    primary_id = user_data.get("primary_email_address_id")
    email = next(
        (ea["email_address"] for ea in email_addresses if ea["id"] == primary_id),
        "",
    )
    # All emails are now eligible — ownership is proven via OTP
    return {"eligible": True, "email": email, "reason": None}


# ── POST /billing/student-claim (kept for backward compatibility) ─────────────

@router.post("/student-claim")
async def student_claim(
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Legacy endpoint kept for backward compatibility.
    New clients should use /student-otp-send → /student-verify instead.
    This endpoint now returns 400 directing callers to the OTP flow.
    """
    raise HTTPException(
        status_code=400,
        detail="Please verify your institutional email to activate the Student Plan.",
    )


# ── POST /billing/webhook ─────────────────────────────────────────────────────

@router.post("/webhook", include_in_schema=False)
async def razorpay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_razorpay_signature: str = Header(None, alias="x-razorpay-signature"),
):
    """
    Razorpay webhook — receives subscription lifecycle events.
    Register this URL in Razorpay Dashboard -> Webhooks.
    No user auth — Razorpay calls this directly.
    """
    if not settings.razorpay_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured.")

    payload = await request.body()

    # Verify HMAC-SHA256 signature
    expected = hmac.new(
        settings.razorpay_webhook_secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, x_razorpay_signature or ""):
        log.warning("razorpay_webhook_invalid_signature")
        raise HTTPException(status_code=400, detail="Invalid signature.")

    import json
    event = json.loads(payload)
    event_type = event.get("event", "")

    log.info("razorpay_webhook", event_type=event_type)

    if event_type == "subscription.activated":
        await handle_razorpay_subscription_activated(db, event.get("payload", {}))
    elif event_type == "subscription.charged":
        await handle_razorpay_subscription_charged(db, event.get("payload", {}))
    elif event_type in ("subscription.cancelled", "subscription.completed", "subscription.expired"):
        await handle_razorpay_subscription_cancelled(db, event.get("payload", {}))
    else:
        log.info("razorpay_webhook_unhandled", event_type=event_type)

    return {"ok": True}


# ── GET /billing/download-backup ──────────────────────────────────────────────

@router.get("/download-backup")
async def download_backup(
    user_id: str = Depends(get_user_id_no_purge),
    db: AsyncSession = Depends(get_db),
):
    """
    Generate and return a PDF of all user data for download.
    Available during the grace period AND after expiry (no purge check).
    """
    from fastapi.responses import Response
    from app.services.backup_service import generate_pdf_bytes

    pdf_bytes = await generate_pdf_bytes(db, user_id)
    now = datetime.now(timezone.utc).strftime("%Y%m%d")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="contextos-backup-{now}.pdf"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )
