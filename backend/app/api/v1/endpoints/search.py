"""
GET /api/v1/search?q=<term>&limit=20
    Returns matched projects and memories, ranked by relevance (title match first).

GET /api/v1/search/suggest?q=<term>&limit=8
    Lightweight prefix-based autocomplete.
    Primary:  prefix  match → index-friendly (ilike 'q%')
    Fallback: substring match (ilike '%q%') if prefix yields < 3 combined hits,
              deduplicated in Python.
    Selects ONLY id + name/title columns — no SELECT *.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project import Project
from app.models.document import Document
from app.api.v1.dependencies import get_user_id

router = APIRouter()


# ── Response models ───────────────────────────────────────────────────────────

class SearchProject(BaseModel):
    id: str
    name: str
    description: Optional[str]
    stack: list[str]
    kind: str = "project"

class SearchMemory(BaseModel):
    id: str
    title: str
    content: str
    tags: list[str]
    kind: str = "memory"

class SearchResults(BaseModel):
    projects: list[SearchProject]
    memories: list[SearchMemory]
    total: int

class SuggestionItem(BaseModel):
    id: str
    label: str
    kind: str   # "project" | "memory"

class SuggestResults(BaseModel):
    suggestions: list[SuggestionItem]
    q: str


# ── /suggest ──────────────────────────────────────────────────────────────────

_SUGGEST_MIN = 3          # if prefix yields fewer combined hits, run fallback too
_CACHE_HEADER = {"Cache-Control": "private, max-age=60"}

@router.get("/suggest", response_model=SuggestResults)
async def suggest(
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(default=8, ge=1, le=20),
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    term = q.strip()
    prefix = f"{term}%"
    sub    = f"%{term}%"
    half   = max(3, limit // 2)

    # ── Prefix pass (index-friendly) ──────────────────────────────────────────
    p_prefix = await db.execute(
        select(Project.id, Project.name)
        .where(Project.user_id == user_id, Project.name.ilike(prefix))
        .limit(half)
    )
    m_prefix = await db.execute(
        select(Document.id, Document.title)
        .where(
            Document.user_id == user_id,
            Document.doc_type == "note",
            Document.title.ilike(prefix),
        )
        .limit(half)
    )

    proj_rows = p_prefix.all()
    mem_rows  = m_prefix.all()

    # ── Fallback substring pass if prefix gives too few results ───────────────
    if len(proj_rows) + len(mem_rows) < _SUGGEST_MIN:
        seen_p = {r[0] for r in proj_rows}
        seen_m = {r[0] for r in mem_rows}

        p_sub = await db.execute(
            select(Project.id, Project.name)
            .where(Project.user_id == user_id, Project.name.ilike(sub))
            .limit(half * 2)
        )
        m_sub = await db.execute(
            select(Document.id, Document.title)
            .where(
                Document.user_id == user_id,
                Document.doc_type == "note",
                Document.title.ilike(sub),
            )
            .limit(half * 2)
        )

        for row in p_sub.all():
            if row[0] not in seen_p:
                proj_rows = list(proj_rows) + [row]
                seen_p.add(row[0])
        for row in m_sub.all():
            if row[0] not in seen_m:
                mem_rows = list(mem_rows) + [row]
                seen_m.add(row[0])

    # ── Merge & trim to `limit` ───────────────────────────────────────────────
    suggestions: list[SuggestionItem] = []
    for row in proj_rows[:half]:
        suggestions.append(SuggestionItem(id=row[0], label=row[1], kind="project"))
    for row in mem_rows[:half]:
        suggestions.append(SuggestionItem(id=row[0], label=row[1], kind="memory"))
    suggestions = suggestions[:limit]

    return JSONResponse(
        content=SuggestResults(suggestions=suggestions, q=term).model_dump(),
        headers=_CACHE_HEADER,
    )


# ── /search ───────────────────────────────────────────────────────────────────

@router.get("", response_model=SearchResults)
async def search(
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(default=20, ge=1, le=50),
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    term = f"%{q.strip()}%"
    half = max(5, limit // 2)

    # Select only the columns we actually render — no SELECT *
    proj_result = await db.execute(
        select(Project.id, Project.name, Project.description, Project.stack)
        .where(
            Project.user_id == user_id,
            or_(
                Project.name.ilike(term),
                Project.description.ilike(term),
                Project.goals.ilike(term),
            ),
        )
        .limit(half)
    )
    projects = [
        SearchProject(
            id=row[0],
            name=row[1],
            description=row[2],
            stack=row[3] or [],
        )
        for row in proj_result.all()
    ]

    mem_result = await db.execute(
        select(Document.id, Document.title, Document.content, Document.tags)
        .where(
            Document.user_id == user_id,
            Document.doc_type == "note",
            or_(
                Document.title.ilike(term),
                Document.content.ilike(term),
            ),
        )
        .limit(half)
    )
    memories = [
        SearchMemory(
            id=row[0],
            title=row[1],
            content=(row[2] or "")[:300],
            tags=row[3] or [],
        )
        for row in mem_result.all()
    ]

    return SearchResults(
        projects=projects,
        memories=memories,
        total=len(projects) + len(memories),
    )
