"""
app/api/v1/endpoints/projects.py
/api/v1/projects — Layer 2 (Projects) CRUD.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import ProjectCreate, ProjectOut, ProjectUpdate, PaginatedProjects
from app.services import (
    create_project,
    delete_project,
    get_project,
    list_projects,
    update_project,
)
from app.api.v1.dependencies import get_user_id
from app.services.subscription_service import check_project_limit
from app.services.thread_event_service import log_thread_event

router = APIRouter()


@router.get("", response_model=PaginatedProjects)
async def list_projects_endpoint(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await list_projects(db, user_id, page, per_page)


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project_endpoint(
    project_id: str,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await get_project(db, project_id, user_id)


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project_endpoint(
    data: ProjectCreate,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    await check_project_limit(db, user_id)
    project = await create_project(db, user_id, data)
    await log_thread_event(
        db,
        project_id=project.id,
        user_id=user_id,
        event_type="project_created",
        title='Project "' + project.name + '" created',
        detail=project.description or "",
    )
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project_endpoint(
    project_id: str,
    data: ProjectUpdate,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    project = await update_project(db, project_id, user_id, data)
    await log_thread_event(
        db,
        project_id=project_id,
        user_id=user_id,
        event_type="project_updated",
        title='Project "' + project.name + '" updated',
    )
    return project


@router.delete("/{project_id}", status_code=204)
async def delete_project_endpoint(
    project_id: str,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    await delete_project(db, project_id, user_id)
