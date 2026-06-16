"""
app/services/project_service.py
"""
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Project
from app.repositories import ProjectRepository
from app.schemas import ProjectCreate, ProjectUpdate, PaginatedProjects, ProjectOut


async def list_projects(
    db: AsyncSession, user_id: str, page: int, per_page: int
) -> PaginatedProjects:
    repo = ProjectRepository(db)
    projects, total = await repo.list_by_user(user_id, page, per_page)
    has_next = (page * per_page) < total
    return PaginatedProjects(
        items=[ProjectOut.model_validate(p) for p in projects],
        total=total,
        page=page,
        per_page=per_page,
        has_next=has_next,
    )


async def get_project(db: AsyncSession, project_id: str, user_id: str) -> Project:
    repo = ProjectRepository(db)
    project = await repo.get(project_id, user_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )
    return project


async def create_project(
    db: AsyncSession, user_id: str, data: ProjectCreate
) -> Project:
    repo = ProjectRepository(db)
    return await repo.create(user_id=user_id, data=data)


async def update_project(
    db: AsyncSession, project_id: str, user_id: str, data: ProjectUpdate
) -> Project:
    project = await get_project(db, project_id, user_id)
    repo = ProjectRepository(db)
    return await repo.update(project=project, data=data)


async def delete_project(
    db: AsyncSession, project_id: str, user_id: str
) -> None:
    project = await get_project(db, project_id, user_id)
    repo = ProjectRepository(db)
    await repo.delete(project)
