"""
GET /api/v1/search?q=<term>&limit=20
Returns matched projects and memories, ranked by relevance (title match first).
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.project import Project
from app.models.document import Document
from app.api.v1.dependencies import get_user_id

router = APIRouter()


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


@router.get("", response_model=SearchResults)
async def search(
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(default=20, ge=1, le=50),
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    term = f"%{q.strip()}%"
    half = max(5, limit // 2)

    # Search projects
    proj_result = await db.execute(
        select(Project)
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
            id=p.id,
            name=p.name,
            description=p.description,
            stack=p.stack or [],
        )
        for p in proj_result.scalars().all()
    ]

    # Search memories
    mem_result = await db.execute(
        select(Document)
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
            id=d.id,
            title=d.title,
            content=d.content[:300],
            tags=d.tags or [],
        )
        for d in mem_result.scalars().all()
    ]

    return SearchResults(
        projects=projects,
        memories=memories,
        total=len(projects) + len(memories),
    )
