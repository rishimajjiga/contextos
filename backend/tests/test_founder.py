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
    assert "trial_users" in stats
    assert "monthly_revenue" in stats and "recent_payments" in stats


# ── Category user lists (clickable dashboard cards) ───────────────────────────

@pytest_asyncio.fixture
async def seeded_users(db_session, founder):
    """Founder (no sub row → free) + five users across every plan/status the
    dashboard cards drill into."""
    def mk(uid, email, name, plan=None, status="active", period_end=None):
        db_session.add(User(id=uid, clerk_id=f"ck_{uid}", email=email, name=name))
        if plan is not None:
            db_session.add(UserSubscription(
                user_id=uid, plan=plan, status=status, current_period_end=period_end,
            ))

    mk("u-alice", "alice@example.com", "Alice Free", plan="free")
    mk("u-bob", "bob@example.com", "Bob Student", plan="student", status="trialing",
       period_end=NOW + timedelta(days=20))
    mk("u-carol", "carol@example.com", "Carol Pro", plan="pro",
       period_end=NOW + timedelta(days=30))
    mk("u-dave", "dave@example.com", "Dave Team", plan="team",
       period_end=NOW + timedelta(days=300))
    mk("u-eve", "eve@example.com", "Eve Expired", plan="pro", status="expired",
       period_end=NOW - timedelta(days=5))
    await db_session.commit()


@pytest.mark.asyncio
async def test_list_users_category_counts_match_dashboard(db_session, seeded_users):
    stats = await fs.dashboard_stats(db_session)
    for category, stat_key in (
        ("total", "total_users"), ("free", "free_users"),
        ("student", "student_users"), ("pro", "pro_users"),
        ("team", "team_users"), ("active", "active_subscriptions"),
        ("expired", "expired_subscriptions"), ("trial", "trial_users"),
        ("today", "todays_signups"),
    ):
        out = await fs.list_users_by_category(db_session, category=category)
        assert out["total"] == stats[stat_key], (
            f"card '{category}' shows {stats[stat_key]} but its list has {out['total']}"
        )
    # Sanity on the seeded shape itself.
    assert (await fs.list_users_by_category(db_session, category="total"))["total"] == 6
    assert (await fs.list_users_by_category(db_session, category="free"))["total"] == 2
    trial = await fs.list_users_by_category(db_session, category="trial")
    assert [u["email"] for u in trial["users"]] == ["bob@example.com"]


@pytest.mark.asyncio
async def test_list_users_search_and_pagination(db_session, seeded_users):
    out = await fs.list_users_by_category(db_session, category="total", q="alice")
    assert out["total"] == 1 and out["users"][0]["name"] == "Alice Free"

    # Search matches name too, and stays inside the category.
    out = await fs.list_users_by_category(db_session, category="pro", q="expired")
    assert out["total"] == 1 and out["users"][0]["email"] == "eve@example.com"

    page1 = await fs.list_users_by_category(db_session, category="total", limit=4, offset=0)
    page2 = await fs.list_users_by_category(db_session, category="total", limit=4, offset=4)
    assert page1["total"] == page2["total"] == 6
    assert len(page1["users"]) == 4 and len(page2["users"]) == 2
    ids = {u["user_id"] for u in page1["users"]} | {u["user_id"] for u in page2["users"]}
    assert len(ids) == 6  # no row skipped or duplicated across pages


@pytest.mark.asyncio
async def test_list_users_sorting(db_session, seeded_users):
    by_plan = await fs.list_users_by_category(db_session, category="total",
                                              sort_by="plan", sort_dir="asc")
    plans = [u["plan"] for u in by_plan["users"]]
    assert plans == sorted(plans)
    assert plans[0] == "free"   # users without a sub row sort as 'free'

    by_email = await fs.list_users_by_category(db_session, category="total",
                                               sort_by="email", sort_dir="asc")
    assert by_email["users"][0]["email"] == "alice@example.com"

    by_last_active = await fs.list_users_by_category(db_session, category="total",
                                                     sort_by="last_active", sort_dir="desc")
    assert by_last_active["total"] == 6
    assert all(u["last_active"] for u in by_last_active["users"])


@pytest.mark.asyncio
async def test_list_users_rejects_bad_input(db_session, seeded_users):
    with pytest.raises(ValueError):
        await fs.list_users_by_category(db_session, category="hackers")
    with pytest.raises(ValueError):
        await fs.list_users_by_category(db_session, sort_by="email; DROP TABLE users")


@pytest.mark.asyncio
async def test_list_endpoint_founder_only(client, db_session, monkeypatch):
    """The signed-in user is NOT a founder → list and export must both 403."""
    monkeypatch.setattr(settings, "founder_emails_raw", FOUNDER_EMAIL, raising=False)
    db_session.add(User(id=TEST_USER_ID, clerk_id="ck_x", email=NORMAL_EMAIL, name="Norm"))
    await db_session.commit()
    assert (await client.get("/api/v1/founder/users/list")).status_code == 403
    assert (await client.get("/api/v1/founder/users/export")).status_code == 403


@pytest.mark.asyncio
async def test_list_and_export_endpoints_for_founder(client, seeded_users):
    resp = await client.get("/api/v1/founder/users/list", params={"category": "trial"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1 and body["users"][0]["email"] == "bob@example.com"
    assert {"user_id", "email", "name", "plan", "status", "signup_date",
            "last_active", "expiry", "platforms"} <= set(body["users"][0])

    resp = await client.get("/api/v1/founder/users/list", params={"category": "nope"})
    assert resp.status_code == 400

    resp = await client.get("/api/v1/founder/users/export", params={"category": "total"})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    text = resp.text
    assert "Email" in text.splitlines()[0]
    assert "alice@example.com" in text
    assert len([l for l in text.splitlines() if l.strip()]) == 7  # header + 6 users
