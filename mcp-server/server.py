"""
ContextOS MCP Server
====================
Gives any MCP-compatible AI tool (Claude, Cursor, Cline, etc.)
the ability to read and write memory in ContextOS.

Tools exposed:
  - get_full_context  Full profile + projects in one call (start here)
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
from typing import Optional

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


# ── Tools ─────────────────────────────────────────────────────────────────────

@mcp.tool()
async def get_full_context(
    format: Optional[str] = "markdown",
) -> str:
    """
    Get the user's complete ContextOS context in a single call:
    their profile and all projects.

    Call this at the start of a session or whenever you need a broad
    understanding of who the user is and what they are working on.

    Args:
        format: Output format — "markdown" (default, rich),
                "text" (compact, for smaller context windows),
                "json" (structured data),
                "system-prompt" (paste-ready system prompt).
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(
            f"{API_URL}/api/v1/context",
            headers=_headers(),
            params={"format": format or "markdown"},
            timeout=20,
        )
        r.raise_for_status()
        return r.text


@mcp.tool()
async def get_profile() -> str:
    """
    Fetch the user's ContextOS profile (role, skills, tone, tech stack).
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
        f"Role: {p.get('role') or 'Not set'}",
    ]
    if p.get("skills"):
        parts.append(f"Skills: {', '.join(p['skills'])}")
    if p.get("programming_languages"):
        parts.append(f"Languages: {', '.join(p['programming_languages'])}")
    if p.get("frameworks"):
        parts.append(f"Frameworks: {', '.join(p['frameworks'])}")
    if p.get("tone"):
        parts.append(f"Tone: {p['tone']}")
    if p.get("response_style"):
        parts.append(f"Response style: {p['response_style']}")
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
    Fetch a single project by ID, including its full description, stack, goals, and tasks.

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
        f"Goals: {p.get('goals') or 'None'}",
        f"Architecture: {p.get('architecture') or 'None'}",
        f"Coding style: {p.get('coding_style') or 'None'}",
        f"Updated: {p.get('updated_at', '')}",
    ]
    if p.get("active_tasks"):
        parts.append("Active tasks:\n" + "\n".join(f"  - {t}" for t in p["active_tasks"]))
    if p.get("current_problems"):
        parts.append("Current problems:\n" + "\n".join(f"  - {pr}" for pr in p["current_problems"]))
    if p.get("repo_url"):
        parts.append(f"Repo: {p['repo_url']}")
    if p.get("live_url"):
        parts.append(f"Live: {p['live_url']}")
    return "\n".join(parts)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.info("Calling mcp.run() with stdio transport")
    mcp.run(transport="stdio")
