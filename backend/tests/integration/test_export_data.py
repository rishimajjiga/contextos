"""
tests/integration/test_export_data.py
Tests for GET /api/v1/users/export-data — the "Download Your Data" PDF export.

Covers: correct headers + real PDF bytes, multi-record export, the empty-state
PDF, and the security guarantee that only the authenticated user's own data is
included.
"""
import io

import pytest

from tests.conftest import TEST_USER_ID

OTHER_USER_ID = "other-user-99999999-9999-9999-9999-999999999999"


async def _add_user(db, uid, name, email):
    from app.models.user import User
    db.add(User(id=uid, clerk_id="clerk_" + uid, email=email, name=name))
    await db.commit()


async def _add_memory(db, uid, title, content, tags):
    from app.models.document import Document
    db.add(Document(
        user_id=uid, title=title, content=content,
        doc_type="note", tags=tags, visibility="private",
    ))
    await db.commit()


def _pdf_text(content: bytes) -> str:
    pypdf = pytest.importorskip("pypdf")
    reader = pypdf.PdfReader(io.BytesIO(content))
    return "\n".join((p.extract_text() or "") for p in reader.pages)


async def test_export_returns_pdf_with_attachment_headers(client, db_session):
    await _add_user(db_session, TEST_USER_ID, "Rishi Majjiga", "rishi@example.com")
    await _add_memory(db_session, TEST_USER_ID, "First memory", "Hello world", ["a", "b"])
    await _add_memory(db_session, TEST_USER_ID, "Second memory", "More\nlines", ["c"])

    resp = await client.get("/api/v1/users/export-data")

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    cd = resp.headers["content-disposition"]
    assert cd.startswith("attachment;")
    assert ".pdf" in cd
    body = resp.content
    assert body[:4] == b"%PDF"
    assert b"%%EOF" in body


async def test_export_includes_only_own_data(client, db_session):
    """Security: another user's memory must never appear in the caller's export."""
    await _add_user(db_session, TEST_USER_ID, "Rishi", "rishi@example.com")
    await _add_user(db_session, OTHER_USER_ID, "Mallory", "m@example.com")
    await _add_memory(db_session, TEST_USER_ID, "MINE_SECRET", "mine", [])
    await _add_memory(db_session, OTHER_USER_ID, "OTHER_SECRET", "theirs", [])

    resp = await client.get("/api/v1/users/export-data")
    assert resp.status_code == 200

    text_all = _pdf_text(resp.content)
    assert "MINE_SECRET" in text_all
    assert "OTHER_SECRET" not in text_all
    assert "Total memories: 1" in text_all


async def test_export_empty_state(client, db_session):
    await _add_user(db_session, TEST_USER_ID, "Rishi", "rishi@example.com")

    resp = await client.get("/api/v1/users/export-data")
    assert resp.status_code == 200
    assert resp.content[:4] == b"%PDF"

    text_all = _pdf_text(resp.content)
    assert "You have no saved memories yet." in text_all
    assert "Total memories: 0" in text_all
