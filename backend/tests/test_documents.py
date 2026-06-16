"""
tests/test_documents.py
Integration tests for /api/v1/documents — CRUD endpoints.

All tests use the in-memory SQLite DB and bypass Clerk auth via conftest fixtures.
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _doc_payload(**overrides) -> dict:
    base = {
        "title": "Test document",
        "content": "Some content about Python and FastAPI.",
        "doc_type": "note",
        "tags": ["python", "fastapi"],
    }
    return {**base, **overrides}


# ─── Tests ────────────────────────────────────────────────────────────────────

async def test_create_document(client: AsyncClient):
    """POST /api/v1/documents returns 201 with the created document."""
    resp = await client.post("/api/v1/documents", json=_doc_payload())
    assert resp.status_code == 201, resp.text

    data = resp.json()
    assert data["title"] == "Test document"
    assert data["doc_type"] == "note"
    assert "python" in data["tags"]
    assert "id" in data


async def test_list_documents(client: AsyncClient):
    """GET /api/v1/documents returns paginated results including what we just created."""
    # Create two docs
    await client.post("/api/v1/documents", json=_doc_payload(title="Doc A"))
    await client.post("/api/v1/documents", json=_doc_payload(title="Doc B"))

    resp = await client.get("/api/v1/documents")
    assert resp.status_code == 200, resp.text

    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)
    assert data["total"] >= 2


async def test_get_document_by_id(client: AsyncClient):
    """GET /api/v1/documents/{id} returns the document."""
    create_resp = await client.post(
        "/api/v1/documents",
        json=_doc_payload(title="Fetchable doc")
    )
    doc_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/documents/{doc_id}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["title"] == "Fetchable doc"


async def test_get_document_not_found(client: AsyncClient):
    """GET /api/v1/documents/{unknown-id} returns 404."""
    resp = await client.get("/api/v1/documents/00000000-0000-0000-0000-000000000000")
    assert resp.status_code == 404


async def test_update_document(client: AsyncClient):
    """PATCH /api/v1/documents/{id} updates fields."""
    create_resp = await client.post(
        "/api/v1/documents",
        json=_doc_payload(title="Original title")
    )
    doc_id = create_resp.json()["id"]

    patch_resp = await client.patch(
        f"/api/v1/documents/{doc_id}",
        json={"title": "Updated title", "tags": ["updated"]},
    )
    assert patch_resp.status_code == 200, patch_resp.text

    data = patch_resp.json()
    assert data["title"] == "Updated title"
    assert "updated" in data["tags"]


async def test_delete_document(client: AsyncClient):
    """DELETE /api/v1/documents/{id} removes the document; second GET returns 404."""
    create_resp = await client.post(
        "/api/v1/documents",
        json=_doc_payload(title="To be deleted")
    )
    doc_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/documents/{doc_id}")
    assert del_resp.status_code == 204

    get_resp = await client.get(f"/api/v1/documents/{doc_id}")
    assert get_resp.status_code == 404


async def test_pagination(client: AsyncClient):
    """per_page and page params work correctly."""
    for i in range(5):
        await client.post(
            "/api/v1/documents",
            json=_doc_payload(title=f"Paginated doc {i}")
        )

    resp = await client.get("/api/v1/documents?page=1&per_page=2")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) <= 2
    assert data["per_page"] == 2
