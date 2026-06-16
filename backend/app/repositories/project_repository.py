"""
app/repositories/project_repository.py
"""
from typing import Optional
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Project
from app.schemas import ProjectCreate, ProjectUpdate


class ProjectRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_by_user(
        self, user_id: str, page: int = 1, per_page: int = 20
    ) -> tuple[list[Project], int]:
        offset = (page - 1) * per_page

        count_q = await self.db.execute(
            select(func.count()).where(Project.user_id == user_id)
        )
        total = count_q.scalar_one()

        result = await self.db.execute(
            select(Project)
            .where(Project.user_id == user_id)
            .order_by(Project.updated_at.desc())
            .offset(offset)
            .limit(per_page)
        )
        return result.scalars().all(), total  # type: ignore[return-value]

    async def get(self, project_id: str, user_id: str) -> Optional[Project]:
        result = await self.db.execute(
            select(Project).where(
                Project.id == project_id, Project.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    async def create(self, user_id: str, data: ProjectCreate) -> Project:
        project = Project(user_id=user_id, **data.model_dump())
        self.db.add(project)
        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def update(self, project: Project, data: ProjectUpdate) -> Project:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(project, field, value)
        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def delete(self, project: Project) -> None:
        await self.db.delete(project)
        await self.db.commit()
