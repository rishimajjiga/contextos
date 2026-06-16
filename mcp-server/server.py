"""
ContextOS MCP Server
====================
Gives any MCP-compatible AI tool (Claude, Cursor, Cline, etc.)
the ability to read and write memory in ContextOS.

Tools exposed:
  - get_full_context  Full profile + projects + knowledge in one call (start here)
  - save_memory       Save a note or document
  - search_memory     Keyword search across all saved memory
  - list_memory       List recent documents (optionally filtered by project)
  - get_document      Fetch a single document by ID
  - delete_document   Delete a document by ID
  - get_profile       Fetch the user's ContextOS profile
  - list_projects     List the user's projects
  - get_project       Fetch a single project by ID

Config (set in .env or environment):
  CONTEXTOS_API_URL   Base URL of the ContextOS API  (default: http://localhost:8000)
  CONTEXTOS_API_KEY   API key generated from the ContextOS dashboard
  CONTEXTOS_TOOL_NAME Name of this tool (sent as X-Tool-Name header, default: contextos-mcp)
"""

import os
import logging
from typing import Any, Optional

import httpx
from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

load_dotenv()

# Log to a file so we can debug startup issues
_log_path = os.path.join(os.path.dirname(__file__), "mcp-debug.log")
logging.basicConfig(
    filename=_log_path,
    level=logging.DEBUG,
    format="%(asctime)s %(levelname)s %(message)s",
)
logging.info("ContextOS MCP server starting up")

API_URL = os.getenv("CONTEXTOS_API_URL", "http://localhost:8000").rstrip("/")
API_KEY = os.getenv("CONTEXTOS_API_KEY", "")
TOOL_NAME = os.getenv("CONTEXTOS_TOOL_NAME", "contextos-mcp")

mcp = FastMCP("ContextOS")


def _headers() -> dict:
    if not API_KEY:
        raise ValueError(
            "CONTEXTOS_API_KEY is not set. "
            "Generate one at http://localhost:8000/docs#/api-keys and set it in mcp-server/.env"
        )
    return {
        "X-Api-Key": API_KEY,
        "X-Tool-Name": TOOL_NAME,
        "Content-Type": "application/json",
    }


def _fmt(doc: dict) -> str:
    """Format a document dict as readable text for the AI."""
    tags = ", ".join(doc.get("tags", [])) or "none"
    return (
        f"ID: {doc['id']}\n"
        f"Title: {doc['title']}\n"
        f"Type: {doc.get('doc_type', 'note')}\n"
        f"Tags: {tags}\n"
        f"Updated: {doc.get('updated_at', '')}\n"
        f"Content:\n{doc.get('content', '')}"
    )


# ── Tools ─────────────────────────────────────────────────────────────────────

@mcp.tool()
async def get_full_context(
    format: Optional[str] = "markdown",
    max_docs: Optional[int] = 10,
) -> str:
    """
    Get the user's complete ContextOS context in a single call:
    their profile, all projects, and recent knowledge.

    Call this at the start of a session or whenever you need a broad
    understanding of who the user is and what they are working on.
    Use search_memory for targeted lookups afterward.

    Args:
        format:   Output format — "markdown" (default, rich),
                  "text" (compact, for smaller context windows).
        max_docs: Max knowledge items to include (default 10).
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{API_URL}/api/v1/context",
            headers=_headers(),
            params={"format": format or "markdown", "max_docs": max_docs or 10},
            timeout=20,
        )
        r.raise_for_status()
        return r.text


@mcp.tool()
async def save_memory(
    title: str,
    content: str,
    tags: Optional[str] = None,
    doc_type: Optional[str] = "note",
    project_id: Optional[str] = None,
) -> str:
    """
    Save a note or piece of information to ContextOS memory.

    Args:
        title:      Short title for the memory (e.g. "User prefers dark mode")
        content:    The full content to store
        tags:       Comma-separated tags (e.g. "preference,ui,rishi")
        doc_type:   Type of document: note, code, pdf, url (default: note)
        project_id: Optional project UUID to associate this memory with
    """
    tag_list = [t.strip() for t in tags.split(",")] if tags else []

    payload: dict[str, Any] = {
        "title": title,
        "content": content,
        "doc_type": doc_type or "note",
        "tags": tag_list,
    }
    if project_id:
        payload["project_id"] = project_id

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{API_URL}/api/v1/documents",
            headers=_headers(),
            json=payload,
            timeout=15,
        )
        r.raise_for_status()
        doc = r.json()

    return f"Saved successfully.\n\n{_fmt(doc)}"


@mcp.tool()
async def search_memory(
    query: str,
    limit: Optional[int] = 10,
    project_id: Optional[str] = None,
) -> str:
    """
    Search ContextOS memory for documents matching a keyword query.

    Args:
        query:      Keywords to search for
        limit:      Max results to return (default 10)
        project_id: Restrict search to a specific project UUID
    """
    payload: dict[str, Any] = {"query": query, "limit": limit or 10}
    if project_id:
        payload["project_id"] = project_id

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{API_URL}/api/v1/search",
            headers=_headers(),
            json=payload,
            timeout=15,
        )
        r.raise_for_status()
        results = r.json()

    items = results.get("results", results) if isinstance(results, dict) else results
    if not items:
        return f"No results found for: {query}"

    parts = [f"Found {len(items)} result(s) for '{query}':\n"]
    for i, item in enumerate(items, 1):
        parts.append(f"--- Result {i} ---")
        parts.append(_fmt(item))
        parts.append("")
    return "\n".join(parts)


@mcp.tool()
async def list_memory(
    limit: Optional[int] = 20,
    project_id: Optional[str] = None,
) -> str:
    """
    List recent documents from ContextOS memory.

    Args:
        limit:      Max number of documents to return (default 20)
        project_id: Filter by project UUID
    """
    params: dict[str, Any] = {"per_page": limit or 20, "page": 1}
    if project_id:
        params["project_id"] = project_id

    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{API_URL}/api/v1/documents",
            headers=_headers(),
            params=params,
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()

    docs = data.get("items", data) if isinstance(data, dict) else data
    if not docs:
        return "No documents found."

    parts = [f"Found {len(docs)} document(s):\n"]
    for doc in docs:
        tags = ", ".join(doc.get("tags", [])) or "none"
        parts.append(f"• [{doc['id'][:8]}...] {doc['title']} (tags: {tags})")
    return "\n".join(parts)


@mcp.tool()
async def get_document(document_id: str) -> str:
    """
    Retrieve the full content of a specific document from ContextOS.

    Args:
        document_id: The UUID of the document to retrieve
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{API_URL}/api/v1/documents/{document_id}",
            headers=_headers(),
            timeout=15,
        )
        if r.status_code == 404:
            return f"Document not found: {document_id}"
        r.raise_for_status()
        doc = r.json()

    return _fmt(doc)


@mcp.tool()
async def delete_document(document_id: str) -> str:
    """
    Delete a document from ContextOS memory.

    Args:
        document_id: The UUID of the document to delete
    """
    async with httpx.AsyncClient() as client:
        r = await client.delete(
            f"{API_URL}/api/v1/documents/{document_id}",
            headers=_headers(),
            timeout=15,
        )
        if r.status_code == 404:
            return f"Document not found: {document_id}"
        r.raise_for_status()

    return f"Document {document_id} deleted successfully."


@mcp.tool()
async def get_profile() -> str:
    """
    Fetch the user's ContextOS profile (name, role, skills, bio).
    Useful for personalizing responses based on who you're talking to.
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{API_URL}/api/v1/profile",
            headers=_headers(),
            timeout=15,
        )
        if r.status_code == 404:
            return "No profile found. The user hasn't set up their ContextOS profile yet."
        r.raise_for_status()
        p = r.json()

    parts = [
        f"Name: {p.get('full_name') or 'Not set'}",
        f"Role: {p.get('role') or 'Not set'}",
        f"Bio: {p.get('bio') or 'Not set'}",
    ]
    if p.get("skills"):
        parts.append(f"Skills: {', '.join(p['skills'])}")
    if p.get("stack"):
        parts.append(f"Tech stack: {', '.join(p['stack'])}")
    if p.get("location"):
        parts.append(f"Location: {p['location']}")
    if p.get("timezone"):
        parts.append(f"Timezone: {p['timezone']}")
    return "\n".join(parts)


@mcp.tool()
async def list_projects(limit: Optional[int] = 20) -> str:
    """
    List the user's ContextOS projects.

    Args:
        limit: Max number of projects to return (default 20)
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{API_URL}/api/v1/projects",
            headers=_headers(),
            params={"per_page": limit or 20, "page": 1},
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()

    projects = data.get("items", data) if isinstance(data, dict) else data
    if not projects:
        return "No projects found."

    parts = [f"Found {len(projects)} project(s):\n"]
    for proj in projects:
        stack = ", ".join(proj.get("stack", [])) or "none"
        parts.append(
            f"• [{proj['id'][:8]}...] {proj['name']}"
            + (f" — {proj['description']}" if proj.get("description") else "")
            + f" (stack: {stack})"
        )
    return "\n".join(parts)


@mcp.tool()
async def get_project(project_id: str) -> str:
    """
    Fetch a single project by ID, including its description and tech stack.

    Args:
        project_id: The UUID of the project to retrieve
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{API_URL}/api/v1/projects/{project_id}",
            headers=_headers(),
            timeout=15,
        )
        if r.status_code == 404:
            return f"Project not found: {project_id}"
        r.raise_for_status()
        p = r.json()

    parts = [
        f"ID: {p['id']}",
        f"Name: {p['name']}",
        f"Description: {p.get('description') or 'None'}",
        f"Stack: {', '.join(p.get('stack', [])) or 'none'}",
        f"Tags: {', '.join(p.get('tags', [])) or 'none'}",
        f"Updated: {p.get('updated_at', '')}",
    ]
    if p.get("repo_url"):
        parts.append(f"Repo: {p['repo_url']}")
    if p.get("live_url"):
        parts.append(f"Live: {p['live_url']}")
    return "\n".join(parts)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.info("Calling mcp.run() with stdio transport")
    mcp.run(transport="stdio")
