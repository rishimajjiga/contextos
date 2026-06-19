"""
app/services/thread_event_service.py
Log and retrieve project thread events.
"""
from typing import List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.thread_event import ThreadEvent


async def log_thread_event(
    db: AsyncSession,
    *,
    project_id: str,
    user_id: str,
    event_type: str,
    title: str,
    detail: str = "",
) -> ThreadEvent:
    """Append one event to the project thread. Fire-and-forget from endpoints."""
    event = ThreadEvent(
        project_id=project_id,
        user_id=user_id,
        event_type=event_type,
        title=title,
        detail=detail,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def list_thread_events(
    db: AsyncSession,
    project_id: str,
    user_id: str,
    limit: int = 100,
    offset: int = 0,
) -> tuple[List[ThreadEvent], int]:
    """Return events for a project, newest first. Also returns total count."""
    base = (
        select(ThreadEvent)
        .where(
            ThreadEvent.project_id == project_id,
            ThreadEvent.user_id == user_id,
        )
    )

    # total
    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar_one()

    # paged, newest-first
    rows_q = (
        base
        .order_by(ThreadEvent.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(rows_q)
    events = list(result.scalars().all())

    return events, total
