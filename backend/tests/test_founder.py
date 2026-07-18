"""
tests/test_founder.py
Founder Panel — access control (403 for non-founders), grant/extend/remove flow,
activity logging, and audience-scoped notifications.
"""
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio

from app.config import settings
from app.models.founder import FounderActivityLog, ManualGrant, Notification
from app.models.subscription import UserSubscription
from app.models.user import User
from app.services import founder_service as fs
from app.api.v1.founder_guard import require_founder

from tests.conftest import TEST_USER_ID

FOUNDER_EMAIL = "founder@usecontextos.com"
NORMAL_EMAIL = "normal@example.com"
NOW = datetime.now(timezone.utc)


@pytest_asyncio.fixture
async def founder(db_session, monkeypatch):
    monkeypatch.setattr(settings, "founder_emails_raw", FOUNDER_EMAIL, raising=False)
    u = User(id=TEST_USER_ID, clerk_id="ck_founder", email=FOUNDER_EMAIL, name="Founder")
    db_session.add(u)
    await db_session.commit()
    return u


@pytest_asyncio.fixture
async def normal_user(db_session):
    u = User(id="user-normal-1", clerk_id="ck_normal", email=NORMAL_EMAIL, name="Norm")
    db_session.add(u)
    db_session.add(UserSubscription(user_id="user-normal-1", plan="free", status="active"))
    await db_session.commit()
    return u


# ── Access control ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_non_founder_gets_403(db_session, normal_user, monkeypatch):
    monkeypatch.setattr(settings, "founder_emails_raw", FOUNDER_EMAIL, raising=False)
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        await require_founder(user_id="user-normal-1", db=db_session)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_founder_allowed(db_session, founder):
    uid = await require_founder(user_id=TEST_USER_ID, db=db_session)
    assert uid == TEST_USER_ID


# ── Grant / extend / remove + activity log ────────────────────────────────────

@pytest.mark.asyncio
async def test_grant_plan_records_grant_and_log(db_session, founder, normal_user):
    res = await fs.grant_plan(
        db_session, actor_user_id=TEST_USER_ID, actor_email=FOUNDER_EMAIL,
        target_user_id="user-normal-1", plan="pro", duration_key="1m",
        reason="Beta testing reward", category="compensation", mode="grant",
    )
    assert res["ok"] and res["plan"] == "pro"

    sub = (await db_session.execute(
        UserSubscription.__table__.select().where(UserSubscription.user_id == "user-normal-1")
    )).first()
    assert sub is not None

    grants = (await db_session.execute(
        ManualGrant.__table__.select().where(ManualGrant.user_id == "user-normal-1")
    )).all()
    assert len(grants) == 1

    logs = (await db_session.execute(FounderActivityLog.__table__.select())).all()
    assert any(r.action == "grant_plan" and r.reason == "Beta testing reward" for r in logs)


@pytest.mark.asyncio
async def test_grant_requires_reason(db_session, founder, normal_user):
    with pytest.raises(ValueError):
        await fs.grant_plan(
            db_session, actor_user_id=TEST_USER_ID, actor_email=FOUNDER_EMAIL,
            target_user_id="user-normal-1", plan="pro", duration_key="1m",
            reason="   ", mode="grant",
        )


@pytest.mark.asyncio
async def test_extend_adds_to_period_end(db_session, founder, normal_user):
    from app.services.subscription_service import get_or_create_subscription
    sub = await get_or_create_subscription(db_session, "user-normal-1")
    sub.plan = "pro"
    sub.current_period_end = NOW + timedelta(days=10)
    await db_session.commit()

    res = await fs.grant_plan(
        db_session, actor_user_id=TEST_USER_ID, actor_email=FOUNDER_EMAIL,
        target_user_id="user-normal-1", plan="pro", duration_key="1m",
        reason="extend test", mode="extend",
    )
    end = datetime.fromisoformat(res["current_period_end"])
    # ~40 days out (10 remaining + 30 added)
    assert 38 <= (end - NOW).days <= 41


@pytest.mark.asyncio
async def test_remove_grant_reverts(db_session, founder, normal_user):
    granted = await fs.grant_plan(
        db_session, actor_user_id=TEST_USER_ID, actor_email=FOUNDER_EMAIL,
        target_user_id="user-normal-1", plan="team", duration_key="3m",
        reason="grant then revert", mode="change",
    )
    out = await fs.remove_grant(
        db_session, actor_user_id=TEST_USER_ID, actor_email=FOUNDER_EMAIL,
        grant_id=granted["grant_id"], reason="mistake",
    )
    assert out["restored_plan"] == "free"   # was free before the grant
    from app.services.subscription_service import get_or_create_subscription
    sub = await get_or_create_subscription(db_session, "user-normal-1")
    assert sub.plan == "free"


# ── Dashboard stats ───────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_dashboard_counts(db_session, founder, normal_user):
    stats = await fs.dashboard_stats(db_session)
    assert stats["total_users"] >= 2
    assert stats["free_users"] >= 1
    assert "monthly_revenue" in stats and "recent_payments" in stats
