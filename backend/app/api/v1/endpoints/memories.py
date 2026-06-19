"""
app/api/v1/endpoints/memories.py

GET    /api/v1/memories          list notes newest first; optional ?q= search
POST   /api/v1/memories          create a note (enforces plan limit)
DELETE /api/v1/memories/{id}     delete a note
"""
import uuid
import json
from datetime import datetime, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, desc, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.document import Document
from app.api.v1.dependencies import get_user_id
from app.services.subscription_service import check_memory_limit

log = structlog.get_logger()
router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class MemoryCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field(..., min_length=1)
    tags: list[str] = Field(default_factory=list)
    project_id: Optional[str] = None


class MemoryOut(BaseModel):
    id: str
    title: str
    content: str
    tags: list[str]
    project_id: Optional[str]
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


def _out(doc: Document) -> MemoryOut:
    return MemoryOut(
        id=str(doc.id),
        title=doc.title,
        content=doc.content or "",
        tags=doc.tags or [],
        project_id=doc.project_id,
        created_at=doc.created_at.isoformat() if doc.created_at else "",
        updated_at=doc.updated_at.isoformat() if doc.updated_at else "",
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[MemoryOut])
async def list_memories(
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
    q: Optional[str] = None,
    project_id: Optional[str] = None,
    limit: int = 100,
):
    """List the user's saved memories, newest first. Optional ?q= searches title+content."""
    stmt = (
        select(Document)
        .where(Document.user_id == user_id, Document.doc_type == "note")
        .order_by(desc(Document.created_at))
        .limit(limit)
    )
    if project_id:
        stmt = stmt.where(Document.project_id == project_id)
    if q and q.strip():
        term = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(
                Document.title.ilike(term),
                Document.content.ilike(term),
            )
        )
    result = await db.execute(stmt)
    return [_out(d) for d in result.scalars().all()]


@router.post("", response_model=MemoryOut, status_code=status.HTTP_201_CREATED)
async def create_memory(
    body: MemoryCreate,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Save a new text note. Enforces plan memory limit."""
    await check_memory_limit(db, user_id)

    note_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # Use a raw INSERT with an explicit column list so we never depend on
    # optional columns (visibility, file_url) that might be missing in older
    # DB installs. PostgreSQL casts [] → ARRAY automatically; the JSON fallback
    # handles SQLite in tests.
    tags_value = body.tags or []

    try:
        await db.execute(
            text(
                "INSERT INTO documents "
                "(id, user_id, project_id, title, content, doc_type, tags, created_at, updated_at) "
                "VALUES (:id, :uid, :pid, :title, :content, :dtype, :tags, :ca, :ua)"
            ),
            {
                "id":      note_id,
                "uid":     user_id,
                "pid":     body.project_id,
                "title":   body.title,
                "content": body.content,
                "dtype":   "note",
                "tags":    tags_value,   # psycopg3 serialises list → PG ARRAY natively
                "ca":      now,
                "ua":      now,
            },
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        # Try again with tags as a JSON-encoded string (fallback for environments
        # where the psycopg ARRAY binding fails).
        try:
            await db.execute(
                text(
                    "INSERT INTO documents "
                    "(id, user_id, project_id, title, content, doc_type, tags, created_at, updated_at) "
                    "VALUES (:id, :uid, :pid, :title, :content, :dtype, CAST(:tags AS jsonb), :ca, :ua)"
                ),
                {
                    "id":      note_id,
                    "uid":     user_id,
                    "pid":     body.project_id,
                    "title":   body.title,
                    "content": body.content,
                    "dtype":   "note",
                    "tags":    json.dumps(tags_value),
                    "ca":      now,
                    "ua":      now,
                },
            )
            await db.commit()
        except Exception as exc2:
            await db.rollback()
            log.error("create_memory: both INSERT attempts failed", err1=str(exc), err2=str(exc2))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save memory: {exc2}",
            )

    # Fetch back the saved row via ORM
    result = await db.execute(select(Document).where(Document.id == note_id))
    note = result.scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=500, detail="Memory saved but could not be retrieved.")
    return _out(note)


@router.delete("/{memory_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_memory(
    memory_id: str,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete a memory by ID."""
    result = await db.execute(
        select(Document).where(Document.id == memory_id, Document.user_id == user_id)
    )
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="Memory not found")
    await db.delete(note)
    await db.commit()
