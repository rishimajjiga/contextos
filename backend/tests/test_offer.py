"""
tests/test_offer.py
New Member / Pro Bonus Offer — eligibility and application tests.

Covers the four spec scenarios:
  1. Existing first-time monthly-Pro user  → offer applied (2 free months)
  2. User already rewarded                 → no duplicate
  3. Cancel-and-resubscribe user           → no offer
  4. Annual (wrong Razorpay plan) / Student → no offer

Razorpay is mocked: `_rzp_client` is monkeypatched with a fake client that
records pause/resume calls, so no network or real billing is touched.
"""
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio

import app.api.v1.endpoints.billing as billing
from app.api.v1.endpoints.billing import (
    _add_months,
    _apply_offer_if_eligible_existing,
    _offer_ineligible_cache,
)
from app.config import settings
from app.models.payment import Payment
from app.models.subscription import UserSubscription
from app.models.user import User

from tests.conftest import TEST_USER_ID, TEST_CLERK_ID

MONTHLY_PRO_PLAN_ID = "plan_test_monthly_pro"
ANNUAL_PRO_PLAN_ID = "plan_test_annual_pro"
RZP_SUB_ID = "sub_test_123"

NOW = datetime.now(timezone.utc)


def _utc(dt: datetime) -> datetime:
    """SQLite (test DB) returns naive datetimes — attach UTC for comparisons."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


class FakeSubscriptionAPI:
    def __init__(self, plan_id: str = MONTHLY_PRO_PLAN_ID, status: str = "active"):
        self.plan_id = plan_id
        self.status = status
        self.pause_calls: list = []
        self.resume_calls: list = []
        self.fail_pause = False

    def fetch(self, sub_id):
        return {"id": sub_id, "plan_id": self.plan_id, "status": self.status}

    def pause(self, sub_id, data):
        if self.fail_pause:
            raise RuntimeError("pause rejected")
        self.pause_calls.append((sub_id, data))
        return {"id": sub_id, "status": "paused"}

    def resume(self, sub_id, data):
        self.resume_calls.append((sub_id, data))
        return {"id": sub_id, "status": "active"}


class FakeRzpClient:
    def __init__(self, subscription_api: FakeSubscriptionAPI):
        self.subscription = subscription_api


@pytest_asyncio.fixture
async def pro_user(db_session):
    """A user with an active monthly-Pro subscription and one captured payment."""
    _offer_ineligible_cache.clear()
    user = User(id=TEST_USER_ID, clerk_id=TEST_CLERK_ID, email="t@example.com", name="T")
    db_session.add(user)
    sub = UserSubscription(
        user_id=TEST_USER_ID,
        plan="pro",
        status="active",
        stripe_subscription_id=RZP_SUB_ID,
        started_at=NOW - timedelta(days=10),
        current_period_end=NOW + timedelta(days=20),
        auto_renew=True,
    )
    db_session.add(sub)
    db_session.add(
        Payment(
            user_id=TEST_USER_ID,
            payment_id="pay_1",
            subscription_id=RZP_SUB_ID,
            amount=49900,
            currency="INR",
            status="captured",
            plan_name="pro",
            purchase_date=NOW - timedelta(days=10),
        )
    )
    await db_session.commit()
    return sub


def _patch_rzp(monkeypatch, api: FakeSubscriptionAPI):
    monkeypatch.setattr(billing, "_rzp_client", lambda: FakeRzpClient(api))
    monkeypatch.setattr(settings, "razorpay_pro_plan_id", MONTHLY_PRO_PLAN_ID, raising=False)


# ── 0. Calendar month math ────────────────────────────────────────────────────

def test_add_months_calendar_accurate():
    jan18 = datetime(2026, 1, 18, tzinfo=timezone.utc)
    assert _add_months(jan18, 2) == datetime(2026, 3, 18, tzinfo=timezone.utc)
    # Feb 18 (paid end) + 2 → Apr 18: the spec's exact example
    feb18 = datetime(2026, 2, 18, tzinfo=timezone.utc)
    assert _add_months(feb18, 2) == datetime(2026, 4, 18, tzinfo=timezone.utc)
    # Day clamping for short months
    jan31 = datetime(2026, 1, 31, tzinfo=timezone.utc)
    assert _add_months(jan31, 1).day == 28
    # Year rollover
    dec18 = datetime(2026, 12, 18, tzinfo=timezone.utc)
    assert _add_months(dec18, 2) == datetime(2027, 2, 18, tzinfo=timezone.utc)


# ── 1. Existing first-time Pro user gets the offer ────────────────────────────

@pytest.mark.asyncio
async def test_existing_first_pro_user_gets_offer(db_session, pro_user, monkeypatch):
    api = FakeSubscriptionAPI()
    _patch_rzp(monkeypatch, api)

    applied = await _apply_offer_if_eligible_existing(db_session, TEST_USER_ID)
    assert applied is True

    await db_session.refresh(pro_user)
    assert pro_user.offer_used is True
    assert pro_user.offer_applied is True
    assert pro_user.offer_free_months == 2
    # 2 calendar months appended after the paid period end
    paid_end = NOW + timedelta(days=20)
    expected_end = _add_months(paid_end, 2)
    assert abs((_utc(pro_user.offer_end_date) - expected_end).total_seconds()) < 5
    assert abs((_utc(pro_user.current_period_end) - expected_end).total_seconds()) < 5
    # Razorpay was actually paused — the offer is real, not just UI
    assert len(api.pause_calls) == 1


# ── 2. Never applied twice ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_offer_never_applied_twice(db_session, pro_user, monkeypatch):
    api = FakeSubscriptionAPI()
    _patch_rzp(monkeypatch, api)

    assert await _apply_offer_if_eligible_existing(db_session, TEST_USER_ID) is True
    assert await _apply_offer_if_eligible_existing(db_session, TEST_USER_ID) is False
    assert len(api.pause_calls) == 1  # paused exactly once


# ── 3. Cancel-and-resubscribe users are excluded ──────────────────────────────

@pytest.mark.asyncio
async def test_cancel_resubscribe_excluded(db_session, pro_user, monkeypatch):
    api = FakeSubscriptionAPI()
    _patch_rzp(monkeypatch, api)

    # An older Pro payment with a >45-day gap = a previous Pro sub ended
    db_session.add(
        Payment(
            user_id=TEST_USER_ID,
            payment_id="pay_0",
            subscription_id="sub_old",
            amount=49900,
            currency="INR",
            status="captured",
            plan_name="pro",
            purchase_date=NOW - timedelta(days=100),
        )
    )
    await db_session.commit()

    assert await _apply_offer_if_eligible_existing(db_session, TEST_USER_ID) is False
    assert api.pause_calls == []


# ── 4a. Annual Pro excluded (Razorpay plan_id is the source of truth) ─────────

@pytest.mark.asyncio
async def test_annual_pro_excluded(db_session, pro_user, monkeypatch):
    api = FakeSubscriptionAPI(plan_id=ANNUAL_PRO_PLAN_ID)
    _patch_rzp(monkeypatch, api)

    assert await _apply_offer_if_eligible_existing(db_session, TEST_USER_ID) is False
    assert api.pause_calls == []


# ── 4b. Non-Pro plans excluded ────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_student_plan_excluded(db_session, pro_user, monkeypatch):
    api = FakeSubscriptionAPI()
    _patch_rzp(monkeypatch, api)

    pro_user.plan = "student"
    await db_session.commit()

    assert await _apply_offer_if_eligible_existing(db_session, TEST_USER_ID) is False
    assert api.pause_calls == []


# ── 5. Pause failure → offer NOT recorded (DB matches Razorpay) ───────────────

@pytest.mark.asyncio
async def test_pause_failure_records_nothing(db_session, pro_user, monkeypatch):
    api = FakeSubscriptionAPI()
    api.fail_pause = True
    _patch_rzp(monkeypatch, api)

    assert await _apply_offer_if_eligible_existing(db_session, TEST_USER_ID) is False
    await db_session.refresh(pro_user)
    assert pro_user.offer_used is False
    assert pro_user.offer_applied is False
    assert pro_user.offer_end_date is None
