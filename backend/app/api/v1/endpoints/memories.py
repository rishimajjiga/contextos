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
from sqlalchemy import select, desc, or_, and_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.document import Document
from app.models.user import User
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
    visibility: str = "private"  # "private" | "team"
    team_id: Optional[str] = None  # optional: explicit team (org) to save into


class MemoryOut(BaseModel):
    id: str
    title: str
    content: str
    tags: list[str]
    project_id: Optional[str]
    visibility: str = "private"
    created_at: str
    updated_at: str
    # Creator info — populated for team-scope listings so the Team workspace can
    # show who shared each memory. None/empty for personal listings.
    user_id: Optional[str] = None
    creator_name: Optional[str] = None
    creator_email: Optional[str] = None

    model_config = {"from_attributes": True}


def _out(doc: Document, creator_name: str | None = None, creator_email: str | None = None) -> MemoryOut:
    return MemoryOut(
        id=str(doc.id),
        title=doc.title,
        content=doc.content or "",
        tags=doc.tags or [],
        project_id=doc.project_id,
        visibility=getattr(doc, "visibility", None) or "private",
        created_at=doc.created_at.isoformat() if doc.created_at else "",
        updated_at=doc.updated_at.isoformat() if doc.updated_at else "",
        user_id=str(doc.user_id),
        creator_name=creator_name,
        creator_email=creator_email,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[MemoryOut])
async def list_memories(
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
    q: Optional[str] = None,
    project_id: Optional[str] = None,
    limit: int = 100,
    scope: Optional[str] = None,   # None/"all" (default, back-compat) | "personal" | "team"
):
    """List the user's saved memories, newest first. Optional ?q= searches title+content."""
    try:
        # Visibility: a user always sees their own private memories. They also see
        # TEAM memories of their org while it has an active Team plan. Once they are
        # removed or the plan lapses, team memories drop out automatically (the rows
        # stay in the DB for remaining members).
        from app.services.org_service import get_user_org_id, org_team_active
        scope_norm = (scope or "all").lower()
        org_id = await get_user_org_id(db, user_id)
        team_ok = bool(org_id) and await org_team_active(db, org_id)
        not_team = or_(Document.visibility.is_(None), Document.visibility != "team")
        own = and_(Document.user_id == user_id, not_team)

        def _apply_filters(stmt):
            if project_id:
                stmt = stmt.where(Document.project_id == project_id)
            if q and q.strip():
                term = f"%{q.strip()}%"
                stmt = stmt.where(or_(Document.title.ilike(term), Document.content.ilike(term)))
            return stmt

        # ── TEAM scope: only the org's shared team memories, with creator info.
        # Membership/active-plan are derived server-side from the caller — a
        # client cannot request another team's memories.
        if scope_norm == "team":
            if not team_ok:
                return []
            stmt = _apply_filters(
                select(Document, User.name, User.email)
                .join(User, User.id == Document.user_id)
                .where(
                    Document.org_id == org_id,
                    Document.visibility == "team",
                    Document.doc_type == "note",
                )
                .order_by(desc(Document.created_at))
                .limit(limit)
            )
            result = await db.execute(stmt)
            return [_out(row[0], creator_name=row[1], creator_email=row[2]) for row in result.all()]

        # ── PERSONAL scope: only the caller's own private memories (no team).
        # ── ALL (default / back-compat): own private + active team memories.
        if scope_norm == "personal":
            visible = own
        elif team_ok:
            visible = or_(own, and_(Document.org_id == org_id, Document.visibility == "team"))
        else:
            visible = own
        stmt = _apply_filters(
            select(Document)
            .where(visible, Document.doc_type == "note")
            .order_by(desc(Document.created_at))
            .limit(limit)
        )
        result = await db.execute(stmt)
        return [_out(d) for d in result.scalars().all()]
    except HTTPException:
        raise
    except Exception as exc:
        log.error(
            "list_memories_failed",
            user_id=user_id,
            q=q,
            project_id=project_id,
            error=str(exc),
            error_type=type(exc).__name__,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load memories: {exc}",
        )


@router.post("", response_model=MemoryOut, status_code=status.HTTP_201_CREATED)
async def create_memory(
    body: MemoryCreate,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Save a new text note. Enforces plan memory limit."""
    await check_memory_limit(db, user_id)

    # Resolve private vs team. Team memories require an active org Team plan and
    # are linked to the org so every current member can see them.
    visibility = "private"
    org_id = None
    if (body.visibility or "private").lower() == "team":
        from app.services.org_service import get_user_org_id, org_team_active
        from app.models.organization import OrganizationMember
        if body.team_id:
            # Explicit team selection: the caller MUST be a member of that exact
            # team (prevents saving into a team you don't belong to), and the
            # team's plan must be active.
            member = await db.execute(
                select(OrganizationMember).where(
                    OrganizationMember.org_id == body.team_id,
                    OrganizationMember.user_id == user_id,
                )
            )
            if member.scalar_one_or_none() is None or not await org_team_active(db, body.team_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You are not a member of that team, or its Team plan is not active.",
                )
            org_id = body.team_id
        else:
            org_id = await get_user_org_id(db, user_id)
            if not org_id or not await org_team_active(db, org_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Team memories require membership in an organization with an active Team plan.",
                )
        visibility = "team"

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
                "(id, user_id, project_id, title, content, doc_type, tags, visibility, org_id, created_at, updated_at) "
                "VALUES (:id, :uid, :pid, :title, :content, :dtype, :tags, :vis, :org, :ca, :ua)"
            ),
            {
                "id":      note_id,
                "uid":     user_id,
                "pid":     body.project_id,
                "title":   body.title,
                "content": body.content,
                "dtype":   "note",
                "tags":    tags_value,   # psycopg3 serialises list → PG ARRAY natively
                "vis":     visibility,
                "org":     org_id,
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
                    "(id, user_id, project_id, title, content, doc_type, tags, visibility, org_id, created_at, updated_at) "
                    "VALUES (:id, :uid, :pid, :title, :content, :dtype, CAST(:tags AS jsonb), :vis, :org, :ca, :ua)"
                ),
                {
                    "id":      note_id,
                    "uid":     user_id,
                    "pid":     body.project_id,
                    "title":   body.title,
                    "content": body.content,
                    "dtype":   "note",
                    "tags":    json.dumps(tags_value),
                    "vis":     visibility,
                    "org":     org_id,
                    "ca":      now,
                    "ua":      now,
                },
            )
            await db.commit()
        except Exception as exc2:
            await db.rollback()
            log.error(
                "create_memory_both_inserts_failed",
                user_id=user_id,
                project_id=body.project_id,
                err1=str(exc),
                err2=str(exc2),
                exc_info=True,
            )
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
