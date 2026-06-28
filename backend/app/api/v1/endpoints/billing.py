"""
app/api/v1/endpoints/billing.py
Razorpay billing — subscription creation, payment verification, webhook, plan info.

Flow:
  1. Frontend calls POST /billing/subscribe  → backend creates Razorpay subscription
  2. Backend returns {subscription_id, key_id} to frontend
  3. Frontend opens Razorpay JS modal with those values
  4. User pays → Razorpay calls POST /billing/webhook (no auth)
  5. Backend verifies HMAC signature and activates the plan
  6. Payment is recorded in the payments table for history

Routes added:
  GET  /billing/payments    — returns paginated payment history for the signed-in user
  POST /billing/reconcile   — recovery: auto-fix subscription mismatches from payment records
"""
import hashlib
import hmac
import uuid
from datetime import datetime, timezone
from sqlalchemy import select, desc, func
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
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.api.v1.dependencies import get_user_id, get_user_id_no_purge
from app.models.payment import Payment
from app.services.subscription_service import (
    PLAN_LIMITS,
    PUBLIC_PLANS,
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


# ── Payment recording helper ──────────────────────────────────────────────────

async def _record_payment(
    db: AsyncSession,
    *,
    user_id: str,
    payment_id: str,
    subscription_id: str | None,
    order_id: str | None,
    amount: int,
    currency: str,
    plan_name: str,
    status: str = "captured",
    purchase_date: datetime | None = None,
) -> None:
    """
    Insert a row into the payments table.
    Silently skips if a row with the same payment_id already exists
    (idempotent — safe to call from both /verify and /webhook).
    """
    from sqlalchemy.exc import IntegrityError

    existing = await db.execute(
        select(Payment).where(Payment.payment_id == payment_id)
    )
    if existing.scalar_one_or_none() is not None:
        return   # already recorded — skip

    payment = Payment(
        id=str(uuid.uuid4()),
        user_id=user_id,
        payment_id=payment_id,
        subscription_id=subscription_id,
        order_id=order_id,
        amount=amount,
        currency=currency,
        status=status,
        plan_name=plan_name,
        purchase_date=purchase_date or datetime.now(timezone.utc),
    )
    db.add(payment)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        log.debug("payment_record_race_skipped", payment_id=payment_id)


# ── Recovery helpers ──────────────────────────────────────────────────────────
# These power the "payment succeeded but plan not activated" recovery paths:
# /reconcile (self-service), /admin/recover (manual), and /recover-sweep (cron).
# The guiding rule: if Razorpay holds a successful payment, the user MUST get
# the plan — even when the verify call and the webhook both failed.

# Razorpay payment statuses that mean money was actually collected / held.
_RZP_SUCCESS_STATUSES = frozenset({"captured", "authorized", "paid"})


def _resolve_plan_from_rzp_sub(rzp_sub: dict) -> str:
    """Map a Razorpay subscription object → our internal plan name.

    Prefers the user_id/plan we stored in `notes`, then falls back to matching
    the Razorpay plan_id against the configured plan IDs. Defaults to "pro"
    because the user has demonstrably just paid — never downgrade on ambiguity.
    """
    notes = (rzp_sub or {}).get("notes", {}) or {}
    plan = notes.get("plan", "")
    if plan in ("pro", "student", "team"):
        return plan
    plan_id = (rzp_sub or {}).get("plan_id", "")
    if plan_id and plan_id in (settings.razorpay_pro_plan_id, settings.razorpay_pro_annual_plan_id):
        return "pro"
    if plan_id and plan_id in (settings.razorpay_team_plan_id, settings.razorpay_team_annual_plan_id):
        return "team"
    if plan_id and plan_id == settings.razorpay_student_plan_id:
        return "student"
    return "pro"


def _apply_active_plan(sub, plan: str, *, current_end_ts=None,
                       started_at: datetime | None = None, sub_id: str | None = None) -> None:
    """Idempotently put a subscription row into the active/paid state.

    Mirrors exactly what /verify does on a successful payment so every recovery
    path leaves the row in the same shape: active, grace cleared, auto-renew on.
    Never removes data; only promotes the row.
    """
    now = datetime.now(timezone.utc)
    sub.plan = plan
    sub.status = "active"
    if sub_id:
        sub.stripe_subscription_id = sub_id
    sub.grace_period_end = None     # clear any stale expired / read-only state
    sub.backup_sent = False
    sub.auto_renew = True
    if sub.started_at is None:
        sub.started_at = started_at or now
    if current_end_ts:
        sub.current_period_end = datetime.fromtimestamp(current_end_ts, tz=timezone.utc)


async def _recover_from_razorpay(
    db: AsyncSession,
    *,
    user_id: str,
    subscription_id: str | None = None,
    payment_id: str | None = None,
) -> dict:
    """
    Authoritative recovery: ask Razorpay directly whether a successful payment
    exists for this user, and if so, record it and activate the plan.

    Used when the local payments table has nothing to go on — i.e. the verify
    call never landed AND the webhook never arrived (classic network-error case).

    Lookup strategy (best-effort, each step wrapped so one failure can't abort):
      1. If payment_id given, fetch that payment directly.
      2. If we have a subscription id (arg or stored), fetch the subscription
         (for plan + period end) and list its invoices to find paid payments.
      3. If ANY payment is captured/authorized/paid → record + activate.

    Idempotent and safe to call repeatedly.
    """
    client = _rzp_client()
    sub = await get_or_create_subscription(db, user_id)
    sub_id = subscription_id or sub.stripe_subscription_id

    # 1. Fetch the Razorpay subscription (plan + current_end) if we know its id.
    rzp_sub: dict = {}
    if sub_id:
        try:
            rzp_sub = client.subscription.fetch(sub_id)
        except Exception as e:
            log.warning("recover_subscription_fetch_failed",
                        user_id=user_id, subscription_id=sub_id, error=str(e))

    plan = _resolve_plan_from_rzp_sub(rzp_sub) if rzp_sub else (
        sub.plan if sub.plan not in ("free", None) else "pro"
    )
    current_end_ts = (rzp_sub or {}).get("current_end")

    # 2. Gather candidate payments.
    candidates: list[dict] = []
    if payment_id:
        try:
            candidates.append(client.payment.fetch(payment_id))
        except Exception as e:
            log.warning("recover_payment_fetch_failed",
                        user_id=user_id, payment_id=payment_id, error=str(e))
    if sub_id:
        try:
            invoices = client.invoice.all({"subscription_id": sub_id, "count": 10})
            for inv in (invoices.get("items", []) if isinstance(invoices, dict) else []):
                pid = inv.get("payment_id")
                if not pid:
                    continue
                try:
                    candidates.append(client.payment.fetch(pid))
                except Exception:
                    continue
        except Exception as e:
            log.warning("recover_invoice_list_failed",
                        user_id=user_id, subscription_id=sub_id, error=str(e))

    # 3. Find the first genuinely successful payment.
    success = next(
        (p for p in candidates if (p or {}).get("status") in _RZP_SUCCESS_STATUSES),
        None,
    )
    if success is None:
        log.info("recover_no_successful_payment",
                 user_id=user_id, subscription_id=sub_id,
                 candidates=len(candidates))
        return {"ok": True, "recovered": False, "reason": "no_successful_payment_in_razorpay"}

    # Record the transaction (idempotent) and activate the plan.
    await _record_payment(
        db,
        user_id=user_id,
        payment_id=success.get("id"),
        subscription_id=sub_id,
        order_id=success.get("order_id"),
        amount=success.get("amount", 0),
        currency=success.get("currency", "INR"),
        plan_name=plan,
        status="captured",
    )
    _apply_active_plan(sub, plan, current_end_ts=current_end_ts, sub_id=sub_id)
    await db.commit()

    log.warning(
        "subscription_recovered_from_razorpay",
        user_id=user_id,
        plan=plan,
        payment_id=success.get("id"),
        subscription_id=sub_id,
        payment_status=success.get("status"),
    )
    return {
        "ok": True,
        "recovered": True,
        "plan": plan,
        "payment_id": success.get("id"),
        "subscription_id": sub_id,
    }


# ── Admin / cron auth guards ──────────────────────────────────────────────────

_optional_bearer = HTTPBearer(auto_error=False)


def _cron_secret_ok(provided: str | None) -> bool:
    """Constant-time compare against the configured CRON_SECRET."""
    return bool(
        settings.cron_secret
        and provided
        and hmac.compare_digest(provided, settings.cron_secret)
    )


async def _require_admin(
    x_cron_secret: str | None = Header(None, alias="X-Cron-Secret"),
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
    x_api_key: str | None = Header(None, alias="X-Api-Key"),
    db: AsyncSession = Depends(get_db),
) -> str:
    """Allow the request if EITHER a valid cron secret OR a logged-in founder.

    Returns an opaque actor string for logging.
    """
    if _cron_secret_ok(x_cron_secret):
        return "cron"

    if credentials or x_api_key:
        try:
            from app.middleware import get_current_user_id
            from app.services import get_or_provision_user
            clerk_id = await get_current_user_id(
                credentials=credentials, x_api_key=x_api_key, db=db
            )
            user = await get_or_provision_user(db, clerk_id)
            if user and user.email and user.email.lower() in settings.founder_emails:
                return f"founder:{user.email.lower()}"
        except Exception as e:
            log.debug("admin_guard_founder_check_failed", error=str(e))

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Admin access required: provide a valid X-Cron-Secret or sign in as a founder.",
    )


async def _require_cron(
    x_cron_secret: str | None = Header(None, alias="X-Cron-Secret"),
) -> bool:
    """Gate cron-only endpoints behind the shared CRON_SECRET."""
    if not _cron_secret_ok(x_cron_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-Cron-Secret.",
        )
    return True


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


# ── GET /billing/plans ────────────────────────────────────────────────────────
# Public endpoint — no auth required. Returns the canonical PLAN_LIMITS dict
# so the frontend pricing page always reflects the exact limits the backend
# enforces, with no duplication.

@router.get("/plans")
async def get_plans():
    """Return quota limits for the publicly selectable plans only.
    Internal-only plans (e.g. founder) are never exposed here."""
    return {plan: PLAN_LIMITS[plan] for plan in PUBLIC_PLANS}


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

    Safety:
    - Clears grace_period_end so expired banner disappears immediately.
    - Sets started_at on first activation.
    - Resets auto_renew to True on new payment.
    - Idempotent: safe to call multiple times for the same payment.
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

    now = datetime.now(timezone.utc)

    # Activate the subscription with the correct plan.
    # FIX: Clear grace_period_end so the expired banner disappears immediately.
    sub = await get_or_create_subscription(db, user_id)
    sub.plan = resolved_plan
    sub.status = "active"
    sub.stripe_subscription_id = body.razorpay_subscription_id
    sub.grace_period_end = None   # ← CRITICAL: clears expired/grace state
    sub.backup_sent = False
    sub.auto_renew = True         # new payment always resets auto-renew to ON
    if sub.started_at is None:
        sub.started_at = now      # record first activation date
    if current_end_ts:
        from datetime import timezone as _tz
        sub.current_period_end = datetime.fromtimestamp(current_end_ts, tz=_tz.utc)
    await db.commit()

    log.info(
        "subscription_activated_via_verify",
        user_id=user_id,
        plan=resolved_plan,
        subscription_id=body.razorpay_subscription_id,
    )

    # Fetch payment details from Razorpay to record amount/currency
    try:
        rzp_payment = client.payment.fetch(body.razorpay_payment_id)
        pay_amount = rzp_payment.get("amount", 0)
        pay_currency = rzp_payment.get("currency", "INR")
    except Exception:
        pay_amount = 0
        pay_currency = "INR"

    # Record the individual payment transaction (idempotent — safe to retry)
    await _record_payment(
        db,
        user_id=user_id,
        payment_id=body.razorpay_payment_id,
        subscription_id=body.razorpay_subscription_id,
        order_id=None,
        amount=pay_amount,
        currency=pay_currency,
        plan_name=resolved_plan,
        status="captured",
        purchase_date=now,
    )

    return {"ok": True, "plan": sub.plan}


# ── POST /billing/cancel ──────────────────────────────────────────────────────

@router.post("/cancel")
async def cancel_subscription(
    body: CancelRequest,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Cancel the user's Razorpay subscription.

    cancel_at_cycle_end=True (default): keeps access until period end, stops renewal.
    cancel_at_cycle_end=False: cancels immediately, downgrades to free.
    """
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

    if body.cancel_at_cycle_end:
        # Keep plan active until period end — just disable auto-renew
        # SAFETY: do NOT downgrade plan or set grace period here.
        # The subscription stays active; Razorpay will send subscription.cancelled
        # webhook when the period actually ends.
        sub.auto_renew = False
    else:
        # Immediate cancellation — downgrade now
        sub.plan = "free"
        sub.status = "active"
        sub.stripe_subscription_id = None
        sub.current_period_end = None
        sub.auto_renew = True
    await db.commit()

    return {"ok": True, "cancel_at_cycle_end": body.cancel_at_cycle_end}


# ── POST /billing/reconcile ───────────────────────────────────────────────────

@router.post("/reconcile")
async def reconcile_subscription(
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Recovery endpoint: checks payment records for successful payments and
    auto-fixes subscription mismatches. Call this from PaymentSuccessPage
    or manually if a user reports being stuck on expired/read-only after paying.

    Logic:
    1. Find the most recent captured payment for this user.
    2. If the subscription is NOT active (or has a stale grace_period_end),
       activate it using the payment record data.
    3. Idempotent — safe to call repeatedly.
    """
    now = datetime.now(timezone.utc)

    # Get the most recent successful payment
    result = await db.execute(
        select(Payment)
        .where(Payment.user_id == user_id, Payment.status == "captured")
        .order_by(desc(Payment.purchase_date))
        .limit(1)
    )
    latest_payment = result.scalar_one_or_none()

    sub = await get_or_create_subscription(db, user_id)

    # ── Step 1: DB-based fix (fast path) ──────────────────────────────────────
    # If we already recorded a successful payment, fix any mismatch from it.
    if latest_payment is not None:
        needs_fix = (
            sub.plan == "free" and latest_payment.plan_name != "free"
        ) or (
            sub.grace_period_end is not None and sub.status == "active"
        ) or (
            sub.status in ("canceled", "past_due", "expired") and
            sub.current_period_end is not None and
            sub.current_period_end > now
        )

        if needs_fix:
            log.warning(
                "subscription_reconcile_fix",
                user_id=user_id,
                payment_id=latest_payment.payment_id,
                plan=latest_payment.plan_name,
                old_status=sub.status,
                grace_period_end=sub.grace_period_end,
            )
            _apply_active_plan(
                sub, latest_payment.plan_name,
                started_at=latest_payment.purchase_date,
            )
            await db.commit()
            return {
                "ok": True,
                "action": "fixed",
                "fixed": True,
                "plan": sub.plan,
                "payment_id": latest_payment.payment_id,
            }

    # ── Step 2: Razorpay-direct fallback ──────────────────────────────────────
    # No usable local payment record, OR the subscription still looks broken
    # despite having paid. This is the network-error case where BOTH the verify
    # call and the webhook failed — the payment only exists inside Razorpay.
    sub_looks_broken = (
        (sub.plan == "free" and sub.stripe_subscription_id) or
        (sub.grace_period_end is not None) or
        (sub.status in ("canceled", "past_due", "expired"))
    )

    if latest_payment is None or sub_looks_broken:
        rec = await _recover_from_razorpay(db, user_id=user_id)
        if rec.get("recovered"):
            return {
                "ok": True,
                "action": "recovered_from_razorpay",
                "fixed": True,
                "plan": rec.get("plan"),
                "payment_id": rec.get("payment_id"),
            }
        return {
            "ok": True,
            "action": "no_payment_found" if latest_payment is None else "no_mismatch",
            "fixed": False,
        }

    return {"ok": True, "action": "no_mismatch", "fixed": False}


# ── POST /billing/admin/recover ───────────────────────────────────────────────

class AdminRecoverRequest(BaseModel):
    user_email: str | None = None
    user_id: str | None = None
    razorpay_payment_id: str | None = None
    razorpay_subscription_id: str | None = None


@router.post("/admin/recover")
async def admin_recover(
    body: AdminRecoverRequest,
    actor: str = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Manual recovery tool. Given a user (by email, internal id, or Razorpay
    subscription id) and/or a specific Razorpay payment id, verify the payment
    with Razorpay and activate the subscription.

    Auth: founder login OR X-Cron-Secret header.

    Body (all optional, but at least one identifier required):
      - user_email             — look up the user by email
      - user_id                — internal user id
      - razorpay_payment_id    — verify/activate from this exact payment
      - razorpay_subscription_id — used to find the user and/or fetch invoices
    """
    from app.models.user import User
    from app.models.subscription import UserSubscription

    # Resolve the target user.
    target_user_id = body.user_id

    if not target_user_id and body.user_email:
        res = await db.execute(
            select(User).where(func.lower(User.email) == body.user_email.strip().lower())
        )
        user = res.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=404, detail=f"No user found with email {body.user_email}.")
        target_user_id = user.id

    if not target_user_id and body.razorpay_subscription_id:
        res = await db.execute(
            select(UserSubscription).where(
                UserSubscription.stripe_subscription_id == body.razorpay_subscription_id
            )
        )
        srow = res.scalar_one_or_none()
        if srow is not None:
            target_user_id = srow.user_id

    if not target_user_id:
        raise HTTPException(
            status_code=400,
            detail="Provide at least one of: user_id, user_email, or razorpay_subscription_id.",
        )

    rec = await _recover_from_razorpay(
        db,
        user_id=target_user_id,
        subscription_id=body.razorpay_subscription_id,
        payment_id=body.razorpay_payment_id,
    )

    sub = await get_or_create_subscription(db, target_user_id)

    log.warning(
        "admin_recovery_action",
        actor=actor,
        target_user_id=target_user_id,
        payment_id=body.razorpay_payment_id,
        subscription_id=body.razorpay_subscription_id,
        recovered=rec.get("recovered"),
    )

    return {
        "ok": True,
        "actor": actor,
        "user_id": target_user_id,
        "recovery": rec,
        "current_plan": sub.plan,
        "status": sub.status,
        "expires_on": sub.current_period_end.isoformat() if sub.current_period_end else None,
    }


# ── POST /billing/recover-sweep ───────────────────────────────────────────────

@router.post("/recover-sweep", include_in_schema=False)
async def recover_sweep(
    _: bool = Depends(_require_cron),
    db: AsyncSession = Depends(get_db),
    limit: int = 200,
):
    """
    Webhook-failure safety net. Designed to run every ~5 minutes from an external
    scheduler (Railway cron / GitHub Action / uptime ping) that sends the
    X-Cron-Secret header.

    Finds subscriptions that have a Razorpay subscription id (so the user paid
    or tried to) but are stuck in a broken state — free, expired, cancelled, or
    sitting in a grace period — and recovers each one from Razorpay.
    """
    from app.models.subscription import UserSubscription

    res = await db.execute(
        select(UserSubscription)
        .where(UserSubscription.stripe_subscription_id.is_not(None))
        .limit(min(limit, 500))
    )
    subs = res.scalars().all()

    checked = 0
    recovered: list[dict] = []

    for s in subs:
        looks_broken = (
            s.plan == "free"
            or s.grace_period_end is not None
            or s.status in ("canceled", "past_due", "expired", "created")
        )
        if not looks_broken:
            continue
        checked += 1
        try:
            rec = await _recover_from_razorpay(
                db, user_id=s.user_id, subscription_id=s.stripe_subscription_id
            )
            if rec.get("recovered"):
                recovered.append({
                    "user_id": s.user_id,
                    "plan": rec.get("plan"),
                    "payment_id": rec.get("payment_id"),
                })
        except Exception as e:
            log.warning("recover_sweep_item_failed", user_id=s.user_id, error=str(e))

    log.info("recover_sweep_complete", scanned=len(subs), checked=checked, recovered=len(recovered))
    return {"ok": True, "scanned": len(subs), "checked": checked, "recovered": recovered}


# ── Educational domain detection ──────────────────────────────────────────────
# Eligibility is determined automatically from the user's Clerk login email.
# No manual input, OTP, or document upload required.
#
# Strategy: check whether the email's domain ends with any known academic
# suffix. Suffixes are ordered longest-first so that ".edu.au" matches before
# a hypothetical bare ".au", preventing false positives.
#
# The pattern *.ac.<cc> (academic + country code) and *.edu.<cc> (education +
# country code) covers most universities worldwide. Individual entries for
# countries that use a different convention (e.g. Japan's .ac.jp, Korea's
# .ac.kr) are included explicitly.

_EDU_SUFFIXES: tuple[str, ...] = (
    # ── Country-specific two-segment suffixes (check before single-segment) ──
    # India
    ".edu.in", ".ac.in",
    # United Kingdom
    ".ac.uk", ".sch.uk",
    # Australia
    ".edu.au", ".ac.au",
    # Singapore
    ".edu.sg", ".ac.sg",
    # Malaysia
    ".edu.my", ".ac.my",
    # Japan
    ".ac.jp", ".ed.jp",
    # South Korea
    ".ac.kr", ".hs.kr",
    # Philippines
    ".edu.ph",
    # Pakistan
    ".edu.pk", ".ac.pk",
    # China (mainland)
    ".edu.cn",
    # Hong Kong
    ".edu.hk", ".ac.hk",
    # Taiwan
    ".edu.tw",
    # New Zealand
    ".ac.nz", ".school.nz",
    # South Africa
    ".ac.za",
    # Ireland
    ".edu.ie",
    # Nigeria
    ".edu.ng", ".ac.ng",
    # Kenya
    ".ac.ke",
    # Ghana
    ".edu.gh", ".ac.gh",
    # Sri Lanka
    ".ac.lk",
    # Bangladesh
    ".edu.bd", ".ac.bd",
    # Nepal
    ".edu.np",
    # Indonesia
    ".ac.id",
    # Thailand
    ".ac.th",
    # Vietnam
    ".edu.vn",
    # Brazil
    ".edu.br",
    # Mexico
    ".edu.mx",
    # Argentina
    ".edu.ar",
    # Colombia
    ".edu.co",
    # Netherlands
    ".edu.nl", ".ac.nl",
    # Portugal
    ".edu.pt",
    # Spain
    ".edu.es",
    # Italy
    ".edu.it",
    # Russia
    ".edu.ru",
    # Turkey
    ".edu.tr", ".ac.tr",
    # Israel
    ".ac.il",
    # UAE
    ".ac.ae",
    # Saudi Arabia
    ".edu.sa",
    # Egypt
    ".edu.eg", ".ac.eg",
    # Jordan
    ".edu.jo",
    # Ethiopia
    ".edu.et",
    # Tanzania
    ".ac.tz",
    # Uganda
    ".ac.ug",
    # Zambia
    ".ac.zm",
    # Zimbabwe
    ".ac.zw",
    # ── Single-segment generic suffix (check last) ────────────────────────────
    # .edu is widely used in the US and adopted by many other countries
    ".edu",
)


def _is_educational_email(email: str) -> bool:
    """
    Return True if the email's domain matches a known academic suffix.

    Matching is case-insensitive and suffix-based — no hardcoded university
    list. Any institution whose domain ends with a recognised educational
    suffix qualifies (e.g. student@iit.ac.in, s123@ox.ac.uk, me@mit.edu).
    """
    try:
        domain = email.strip().lower().split("@", 1)[1]
    except IndexError:
        return False
    # A domain like "student.university.edu.au" should still match ".edu.au"
    return any(domain == suffix.lstrip(".") or domain.endswith(suffix)
               for suffix in _EDU_SUFFIXES)


# ── GET /billing/student-check ────────────────────────────────────────────────

@router.get("/student-check")
async def student_check(
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Check whether the signed-in user's email belongs to an educational
    institution. Email is read from our DB (populated at first sign-in) —
    no extra Clerk API call needed.
    """
    from app.models.user import User

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    email = user.email if user else ""

    eligible = _is_educational_email(email)
    return {
        "eligible": eligible,
        "email": email,
        "reason": None if eligible else (
            f"'{email}' does not appear to be an institutional email address. "
            "Please sign in with your university or college email to access the Student Plan."
        ),
    }


# ── POST /billing/student-claim ───────────────────────────────────────────────

@router.post("/student-claim")
async def student_claim(
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Activate a 30-day free trial of the Student Plan.
    Re-checks the domain server-side before granting access — the frontend
    check is UX only; this is the authoritative gate.
    """
    from datetime import timedelta
    from app.models.user import User

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    email = user.email if user else ""

    if not _is_educational_email(email):
        raise HTTPException(
            status_code=400,
            detail=(
                f"'{email}' is not eligible for the Student Plan. "
                "Please sign in with your university or college email address."
            ),
        )

    sub = await get_or_create_subscription(db, user_id)
    if sub.plan == "student" and sub.status == "trialing":
        raise HTTPException(status_code=400, detail="You already have an active student trial.")
    if sub.plan == "student" and sub.status == "active":
        raise HTTPException(status_code=400, detail="You already have an active student subscription.")
    # One trial per account, ever. Once the 30-day trial has been claimed it
    # cannot be re-activated — even after it expires and the plan reverts to
    # free — otherwise an expired user could call this endpoint repeatedly for
    # unlimited free Student access.
    if sub.trial_used:
        raise HTTPException(
            status_code=400,
            detail=(
                "You've already used your free Student trial. "
                "Upgrade to a paid plan to keep premium features."
            ),
        )

    now = datetime.now(timezone.utc)
    sub.plan = "student"
    sub.status = "trialing"
    sub.trial_used = True
    sub.current_period_end = now + timedelta(days=30)
    # Record when the trial began so the dashboard can show a start date and the
    # 30-day window is auditable.
    if sub.started_at is None:
        sub.started_at = now
    await db.commit()

    log.info("student_trial_activated", user_id=user_id, email=email)
    return {
        "ok": True,
        "trial_ends": sub.current_period_end.isoformat(),
    }


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
    Handles: subscription.activated, subscription.charged, subscription.cancelled,
             subscription.completed, subscription.expired, payment.failed, refund.processed
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

    event_payload = event.get("payload", {})

    if event_type == "subscription.activated":
        await handle_razorpay_subscription_activated(db, event_payload)

    elif event_type == "subscription.charged":
        await handle_razorpay_subscription_charged(db, event_payload)
        # Record the individual charge as a payment transaction
        rzp_sub = event_payload.get("subscription", {}).get("entity", {})
        rzp_payment_entity = event_payload.get("payment", {}).get("entity", {})
        sub_id = rzp_sub.get("id")
        pay_id = rzp_payment_entity.get("id")
        notes = rzp_sub.get("notes", {})
        uid = notes.get("user_id")
        plan = notes.get("plan", "pro")
        if uid and pay_id:
            await _record_payment(
                db,
                user_id=uid,
                payment_id=pay_id,
                subscription_id=sub_id,
                order_id=rzp_payment_entity.get("order_id"),
                amount=rzp_payment_entity.get("amount", 0),
                currency=rzp_payment_entity.get("currency", "INR"),
                plan_name=plan,
                status="captured",
            )

    elif event_type in ("subscription.cancelled", "subscription.completed", "subscription.expired"):
        await handle_razorpay_subscription_cancelled(db, event_payload)

    elif event_type == "payment.failed":
        # Record failed payment attempts so they show in history
        rzp_payment_entity = event_payload.get("payment", {}).get("entity", {})
        pay_id = rzp_payment_entity.get("id")
        sub_id = rzp_payment_entity.get("subscription_id")
        if pay_id and sub_id:
            from app.models.subscription import UserSubscription
            result = await db.execute(
                select(UserSubscription).where(
                    UserSubscription.stripe_subscription_id == sub_id
                )
            )
            sub_row = result.scalar_one_or_none()
            if sub_row:
                await _record_payment(
                    db,
                    user_id=sub_row.user_id,
                    payment_id=pay_id,
                    subscription_id=sub_id,
                    order_id=rzp_payment_entity.get("order_id"),
                    amount=rzp_payment_entity.get("amount", 0),
                    currency=rzp_payment_entity.get("currency", "INR"),
                    plan_name=sub_row.plan,
                    status="failed",
                )

    elif event_type == "refund.processed":
        # Mark the original payment as refunded
        rzp_refund = event_payload.get("refund", {}).get("entity", {})
        original_payment_id = rzp_refund.get("payment_id")
        if original_payment_id:
            existing = await db.execute(
                select(Payment).where(Payment.payment_id == original_payment_id)
            )
            pay_row = existing.scalar_one_or_none()
            if pay_row:
                pay_row.status = "refunded"
                await db.commit()

    else:
        log.info("razorpay_webhook_unhandled", event_type=event_type)

    return {"ok": True}


# ── GET /billing/payments ─────────────────────────────────────────────────────

@router.get("/payments")
async def get_payment_history(
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    """
    Return the authenticated user's payment history, most recent first.
    Each entry contains: payment_id, amount, currency, status, plan_name,
    purchase_date, plus subscription-level details (expires_on, auto_renew,
    days_remaining) from the current subscription row.
    """
    from app.models.subscription import UserSubscription

    result = await db.execute(
        select(Payment)
        .where(Payment.user_id == user_id)
        .order_by(desc(Payment.purchase_date))
        .limit(min(limit, 100))
        .offset(offset)
    )
    payments = result.scalars().all()

    # Fetch subscription for extra billing details
    sub_result = await db.execute(
        select(UserSubscription).where(UserSubscription.user_id == user_id)
    )
    sub = sub_result.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    # Subscription-level details to attach to payment rows
    started_on = None
    expires_on = None
    auto_renew = True
    days_remaining = None

    if sub:
        started_on = sub.started_at.isoformat() if sub.started_at else None
        expires_on = sub.current_period_end.isoformat() if sub.current_period_end else None
        auto_renew = bool(sub.auto_renew)
        if sub.current_period_end and sub.current_period_end > now:
            delta = sub.current_period_end - now
            days_remaining = delta.days

    return {
        "payments": [
            {
                "id": p.id,
                "payment_id": p.payment_id,
                "order_id": p.order_id,
                "subscription_id": p.subscription_id,
                "amount": p.amount,
                "amount_display": f"₹{p.amount / 100:,.0f}" if p.currency == "INR" else f"{p.currency} {p.amount / 100:.2f}",
                "currency": p.currency,
                "status": p.status,
                "plan_name": p.plan_name,
                "purchase_date": p.purchase_date.isoformat(),
                # Subscription-level billing details
                "started_on": started_on,
                "expires_on": expires_on,
                "auto_renew": auto_renew,
                "days_remaining": days_remaining,
            }
            for p in payments
        ],
        "total": len(payments),
        "offset": offset,
        "limit": limit,
    }


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
        },
    )
