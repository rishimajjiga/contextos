"""
app/api/v1/endpoints/threads.py
GET /api/v1/projects/{project_id}/thread
Returns the chronological event log for a project (Context Thread).
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import ThreadOut
from app.api.v1.dependencies import get_user_id
from app.services.thread_event_service import list_thread_events

router = APIRouter()


@router.get("/{project_id}/thread", response_model=ThreadOut)
async def get_project_thread(
    project_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return all thread events for a project, newest first."""
    events, total = await list_thread_events(
        db, project_id=project_id, user_id=user_id, limit=limit, offset=offset
    )
    return ThreadOut(events=events, total=total)
