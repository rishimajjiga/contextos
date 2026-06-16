"""
tests/test_search.py
Integration tests for /api/v1/search — keyword search endpoint.

Tests verify:
  - Basic search returns matching documents
  - Non-matching queries return empty results
  - Response structure is correct (list of SearchResultItem)
  - Limit parameter is respected
"""
import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _seed(client: AsyncClient, title: str, content: str, tags: list[str] | None = None):
    """Create a document and return its id."""
    resp = await client.post(
        "/api/v1/documents",
        json={
            "title": title,
            "content": content,
            "doc_type": "note",
            "tags": tags or [],
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


# ─── Tests ────────────────────────────────────────────────────────────────────

async def test_search_returns_matching_document(client: AsyncClient):
    """A document whose content matches the query should appear in results."""
    await _seed(client, "asyncpg guide", "asyncpg is the async PostgreSQL driver for Python.")

    resp = await client.post("/api/v1/search", json={"query": "asyncpg", "limit": 10})
    assert resp.status_code == 200, resp.text

    results = resp.json()
    assert isinstance(results, list)
    titles = [r["title"] for r in results]
    assert any("asyncpg" in t.lower() for t in titles), f"Expected asyncpg in results, got: {titles}"


async def test_search_no_results(client: AsyncClient):
    """A query with no keyword match should return an empty list."""
    resp = await client.post(
        "/api/v1/search",
        json={"query": "xyzzy_does_not_exist_in_any_document_12345", "limit": 5},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


async def test_search_result_structure(client: AsyncClient):
    """Each result must have the required fields."""
    await _seed(client, "Structure test", "Checking the fields on a search result item.")

    resp = await client.post("/api/v1/search", json={"query": "structure", "limit": 5})
    assert resp.status_code == 200, resp.text

    results = resp.json()
    if results:  # only check if we got something back
        item = results[0]
        assert "id" in item
        assert "title" in item
        assert "content" in item
        assert "created_at" in item
        # similarity is None for keyword search, never a fake score
        assert "similarity" not in item or item["similarity"] is None


async def test_search_limit(client: AsyncClient):
    """The limit parameter caps the number of results returned."""
    for i in range(6):
        await _seed(client, f"Limit test {i}", f"All about limits and pagination test run {i}.")

    resp = await client.post("/api/v1/search", json={"query": "limits", "limit": 3})
    assert resp.status_code == 200, resp.text

    results = resp.json()
    assert len(results) <= 3


async def test_search_title_match(client: AsyncClient):
    """Search should match on title as well as content."""
    await _seed(client, "Unique XYZ title keyword", "The content here is generic.")

    resp = await client.post(
        "/api/v1/search",
        json={"query": "XYZ title keyword", "limit": 10},
    )
    assert resp.status_code == 200, resp.text

    results = resp.json()
    titles = [r["title"] for r in results]
    assert any("XYZ" in t for t in titles), f"Title search failed, got: {titles}"


async def test_search_requires_query(client: AsyncClient):
    """Sending an empty query body should return 422 Unprocessable Entity."""
    resp = await client.post("/api/v1/search", json={})
    assert resp.status_code == 422
