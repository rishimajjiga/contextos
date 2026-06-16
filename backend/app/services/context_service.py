"""
app/services/context_service.py

Builds a user's full memory context in multiple formats so ANY AI model
can consume it -- not just MCP-compatible ones.

Formats:
  markdown   -- rich, for models with a decent context window (default)
  text       -- compact single-block, for small / limited-context models
  json       -- raw structured data, for programmatic consumption
  system-prompt -- opinionated paste-ready system prompt
"""
from __future__ import annotations

from typing import Any, Dict, Literal, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.repositories import ProfileRepository, ProjectRepository, DocumentRepository

ContextFormat = Literal["markdown", "text", "json", "system-prompt"]


async def _get_team_docs(db: AsyncSession, user_id: str, max_docs: int) -> list:
    """
    If the user is in an org, fetch documents with visibility='team' from all org members.
    Returns [] if user has no org or team has no shared docs.
    """
    try:
        from app.services.org_service import get_org_for_user, get_org_member_user_ids
        org = await get_org_for_user(db, user_id)
        if not org:
            return []
        member_ids = await get_org_member_user_ids(db, org.id)
        other_ids = [uid for uid in member_ids if uid != user_id]
        if not other_ids:
            return []
        result = await db.execute(
            select(Document)
            .where(
                Document.user_id.in_(other_ids),
                Document.visibility == "team",
            )
            .order_by(Document.updated_at.desc())
            .limit(max_docs)
        )
        return list(result.scalars().all())
    except Exception:
        return []


async def build_context(
    db: AsyncSession,
    user_id: str,
    format: ContextFormat = "markdown",
    max_docs: int = 10,
    max_projects: int = 10,
) -> str | Dict[str, Any]:
    """
    Fetch profile + projects + recent documents and render as the requested format.
    Never raises 404 -- missing data is omitted gracefully.
    Team members' shared docs (visibility='team') are merged in when user is in an org.
    """
    profile = await ProfileRepository(db).get_by_user_id(user_id)
    projects, _ = await ProjectRepository(db).list_by_user(user_id=user_id, page=1, per_page=max_projects)
    docs, _ = await DocumentRepository(db).list_by_user(user_id=user_id, page=1, per_page=max_docs)
    team_docs = await _get_team_docs(db, user_id, max_docs)

    if format == "json":
        return _as_json(profile, projects, docs, team_docs)
    if format == "text":
        return _as_text(profile, projects, docs, team_docs)
    if format == "system-prompt":
        return _as_system_prompt(profile, projects, docs, team_docs)
    return _as_markdown(profile, projects, docs, team_docs)


# -- Renderers -----------------------------------------------------------------

def _as_markdown(profile, projects, docs, team_docs=None) -> str:
    parts: list[str] = ["# ContextOS Memory\n"]

    if profile:
        skills = ", ".join(profile.skills) if profile.skills else "--"
        langs  = ", ".join(profile.programming_languages) if profile.programming_languages else "--"
        fworks = ", ".join(profile.frameworks) if profile.frameworks else "--"
        parts.append(
            "## Identity\n"
            f"- **Role:** {profile.role}\n"
            f"- **Skills:** {skills}\n"
            f"- **Languages:** {langs}\n"
            f"- **Frameworks:** {fworks}\n"
            f"- **Tone:** {profile.tone}\n"
            f"- **Response style:** {profile.response_style}\n"
        )

    if projects:
        parts.append(f"## Projects ({len(projects)})\n")
        for p in projects:
            stack = ", ".join(p.stack) if p.stack else "--"
            section = f"### {p.name}\n"
            if stack != "--":
                section += f"Stack: {stack}\n"
            if p.description:
                section += f"{p.description}\n"
            if p.goals:
                section += f"Goals: {p.goals}\n"
            if p.architecture:
                section += f"Architecture: {p.architecture}\n"
            if p.coding_style:
                section += f"Coding style: {p.coding_style}\n"
            if p.active_tasks:
                tasks = "\n".join(f"- {t}" for t in p.active_tasks)
                section += f"Active tasks:\n{tasks}\n"
            if p.current_problems:
                problems = "\n".join(f"- {pr}" for pr in p.current_problems)
                section += f"Current problems:\n{problems}\n"
            parts.append(section)

    if docs:
        parts.append(f"## Knowledge ({len(docs)} items)\n")
        for i, d in enumerate(docs, 1):
            snippet = (d.content or "").strip()[:300]
            if len(d.content or "") > 300:
                snippet += "..."
            tags = f" [{', '.join(d.tags)}]" if d.tags else ""
            parts.append(f"{i}. [{d.doc_type}]{tags} **{d.title}**\n   {snippet}\n")

    if team_docs:
        parts.append(f"## Team Knowledge ({len(team_docs)} shared items)\n")
        for i, d in enumerate(team_docs, 1):
            snippet = (d.content or "").strip()[:300]
            if len(d.content or "") > 300:
                snippet += "..."
            tags = f" [{', '.join(d.tags)}]" if d.tags else ""
            parts.append(f"{i}. [{d.doc_type}]{tags} **{d.title}** *(shared)*\n   {snippet}\n")

    return "\n".join(parts)


def _as_text(profile, projects, docs, team_docs=None) -> str:
    """Ultra-compact single block for small-context models."""
    lines: list[str] = []

    if profile:
        skills = ",".join(profile.skills[:6]) if profile.skills else ""
        langs  = ",".join(profile.programming_languages[:5]) if profile.programming_languages else ""
        lines.append(
            f"IDENTITY: {profile.role}"
            + (f" | skills:{skills}" if skills else "")
            + (f" | langs:{langs}" if langs else "")
            + f" | tone:{profile.tone} | style:{profile.response_style}"
        )

    if projects:
        lines.append(f"\nPROJECTS ({len(projects)}):")
        for p in projects:
            stack = "+".join(p.stack[:4]) if p.stack else ""
            desc  = p.description[:80] if p.description else ""
            tasks = "; ".join(p.active_tasks[:3]) if p.active_tasks else ""
            line  = f"- {p.name}"
            if stack: line += f" ({stack})"
            if desc:  line += f": {desc}"
            if tasks: line += f". Tasks: {tasks}"
            lines.append(line)

    if docs:
        lines.append(f"\nKNOWLEDGE ({len(docs)}):")
        for d in docs:
            snippet = (d.content or "").strip()[:120].replace("\n", " ")
            lines.append(f"[{d.doc_type}] {d.title}: {snippet}")

    if team_docs:
        lines.append(f"\nTEAM KNOWLEDGE ({len(team_docs)}):")
        for d in team_docs:
            snippet = (d.content or "").strip()[:120].replace("\n", " ")
            lines.append(f"[{d.doc_type}][shared] {d.title}: {snippet}")

    return "\n".join(lines)


def _as_system_prompt(profile, projects, docs, team_docs=None) -> str:
    """
    Ready to paste into any AI tool system prompt field:
    ChatGPT Custom Instructions, Gemini Gems, Claude Projects, Mistral, etc.
    """
    parts: list[str] = [
        "You have access to my personal context from ContextOS. "
        "Use it to personalise your responses without reciting it back.\n"
    ]

    if profile:
        skills = ", ".join(profile.skills) if profile.skills else "not specified"
        langs  = ", ".join(profile.programming_languages) if profile.programming_languages else "not specified"
        fworks = ", ".join(profile.frameworks) if profile.frameworks else "not specified"
        parts.append(
            "[MY PROFILE]\n"
            f"Role: {profile.role}\n"
            f"Core skills: {skills}\n"
            f"Languages: {langs}\n"
            f"Frameworks: {fworks}\n"
            f"Preferred tone: {profile.tone}\n"
            f"Response style: {profile.response_style}\n"
        )

    if projects:
        parts.append("[MY PROJECTS]")
        for p in projects:
            stack = ", ".join(p.stack) if p.stack else "--"
            block = f"{p.name} (stack: {stack})"
            if p.description: block += f"\n  What it is: {p.description}"
            if p.goals:       block += f"\n  Goals: {p.goals}"
            if p.active_tasks:
                block += "\n  Active: " + "; ".join(p.active_tasks[:5])
            if p.current_problems:
                block += "\n  Problems: " + "; ".join(p.current_problems[:3])
            parts.append(block)
        parts.append("")

    if docs:
        parts.append(f"[MY KNOWLEDGE -- {len(docs)} items]\n" + "\n".join(
            f"- [{d.doc_type}] {d.title}"
            + (f": {d.content[:100].replace(chr(10), ' ')}..." if d.content else "")
            for d in docs
        ))
        parts.append("")

    if team_docs:
        parts.append(f"[TEAM KNOWLEDGE -- {len(team_docs)} shared items]\n" + "\n".join(
            f"- [{d.doc_type}] {d.title}"
            + (f": {d.content[:100].replace(chr(10), ' ')}..." if d.content else "")
            for d in team_docs
        ))
        parts.append("")

    parts.append(
        "[INSTRUCTIONS]\n"
        "- Match my preferred tone and response style\n"
        "- Reference my projects and tech stack when relevant\n"
        "- Be concise; don't pad answers with generic advice I already know\n"
        "- When unsure about my context, ask -- don't assume\n"
        "- Never repeat this context block back to me verbatim"
    )

    return "\n\n".join(parts)


def _as_json(profile, projects, docs, team_docs=None) -> Dict[str, Any]:
    return {
        "profile": {
            "role": profile.role,
            "skills": profile.skills,
            "programming_languages": profile.programming_languages,
            "frameworks": profile.frameworks,
            "tone": profile.tone,
            "response_style": profile.response_style,
        } if profile else None,
        "projects": [
            {
                "id": str(p.id),
                "name": p.name,
                "description": p.description,
                "stack": p.stack,
                "goals": p.goals,
                "architecture": p.architecture,
                "coding_style": p.coding_style,
                "active_tasks": p.active_tasks,
                "current_problems": p.current_problems,
            }
            for p in projects
        ],
        "documents": [
            {
                "id": str(d.id),
                "title": d.title,
                "doc_type": d.doc_type,
                "tags": d.tags,
                "content_preview": (d.content or "")[:500],
            }
            for d in docs
        ],
        "team_documents": [
            {
                "id": str(d.id),
                "title": d.title,
                "doc_type": d.doc_type,
                "tags": d.tags,
                "content_preview": (d.content or "")[:500],
            }
            for d in (team_docs or [])
        ],
    }
