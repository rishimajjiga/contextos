"""
tests/test_account_deletion.py
Google Play / GDPR account deletion — POST /api/v1/users/me/delete.

Covers:
- Confirmation guard: wrong/missing confirm string deletes nothing.
- Happy path: all personal data rows removed, user row anonymized (not deleted,
  so payment/subscription FKs stay valid), Clerk identity deletion invoked with
  the ORIGINAL clerk id.
- Scoping: another user's data is untouched.
"""
import pytest
from sqlalchemy import select

from app.models import User
from app.models.api_key import ApiKey
from app.models.device_token import DeviceToken
from app.models.document import Document
from app.models.profile import Profile
from app.models.project import Project
from app.services import user_service

from .conftest import TEST_CLERK_ID, TEST_USER_ID

OTHER_USER_ID = "test-user-00000000-0000-0000-0000-000000000002"


async def _seed(db):
    db.add(User(id=TEST_USER_ID, clerk_id=TEST_CLERK_ID, email="doomed@example.com", name="Doomed User"))
    db.add(User(id=OTHER_USER_ID, clerk_id="user_other_clerk_id", email="bystander@example.com", name="Bystander"))
    db.add(Document(user_id=TEST_USER_ID, title="my memory", content="private note"))
    db.add(Document(user_id=OTHER_USER_ID, title="other memory", content="not yours"))
    db.add(Project(user_id=TEST_USER_ID, name="my project"))
    db.add(ApiKey(user_id=TEST_USER_ID, name="ContextOS Mobile", key_prefix="ctxos_ab", key_hash="a" * 64))
    db.add(DeviceToken(user_id=TEST_USER_ID, token="fcm-token-1", platform="android", active=True))
    db.add(Profile(user_id=TEST_USER_ID, role="dev"))
    await db.commit()


@pytest.mark.asyncio
async def test_delete_requires_confirmation(client, db_session, monkeypatch):
    await _seed(db_session)
    called = []
    monkeypatch.setattr(user_service, "delete_clerk_identity", _record(called))

    res = await client.post("/api/v1/users/me/delete", json={"confirm": "delete"})
    assert res.status_code == 400

    res = await client.post("/api/v1/users/me/delete", json={})
    assert res.status_code == 422  # missing required field

    # Nothing was deleted, nothing was anonymized, Clerk untouched.
    docs = (await db_session.execute(select(Document).where(Document.user_id == TEST_USER_ID))).scalars().all()
    assert len(docs) == 1
    user = (await db_session.execute(select(User).where(User.id == TEST_USER_ID))).scalar_one()
    assert user.email == "doomed@example.com"
    assert called == []


@pytest.mark.asyncio
async def test_delete_removes_data_and_anonymizes(client, db_session, monkeypatch):
    await _seed(db_session)
    called = []
    monkeypatch.setattr(user_service, "delete_clerk_identity", _record(called))

    res = await client.post("/api/v1/users/me/delete", json={"confirm": "DELETE"})
    assert res.status_code == 200
    assert res.json()["ok"] is True

    # Every personal-data table is empty for the deleted user…
    for model in (Document, Project, ApiKey, DeviceToken, Profile):
        rows = (await db_session.execute(select(model).where(model.user_id == TEST_USER_ID))).scalars().all()
        assert rows == [], f"{model.__name__} rows survived deletion"

    # …the user row survives ONLY as an anonymized shell (payments FK target)…
    user = (await db_session.execute(select(User).where(User.id == TEST_USER_ID))).scalar_one()
    assert user.email == f"deleted-{TEST_USER_ID}@deleted.invalid"
    assert user.name == ""
    assert user.clerk_id == f"deleted:{TEST_USER_ID}"

    # …the Clerk identity deletion got the ORIGINAL clerk id…
    assert called == [TEST_CLERK_ID]

    # …and the bystander's data is untouched.
    other_docs = (await db_session.execute(select(Document).where(Document.user_id == OTHER_USER_ID))).scalars().all()
    assert len(other_docs) == 1
    other = (await db_session.execute(select(User).where(User.id == OTHER_USER_ID))).scalar_one()
    assert other.email == "bystander@example.com"


def _record(bucket):
    async def fake_delete_clerk_identity(clerk_id: str) -> None:
        bucket.append(clerk_id)
    return fake_delete_clerk_identity
