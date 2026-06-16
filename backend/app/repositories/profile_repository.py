"""
app/repositories/profile_repository.py
"""
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Profile
from app.schemas import ProfileCreate, ProfileUpdate


class ProfileRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_user_id(self, user_id: str) -> Optional[Profile]:
        result = await self.db.execute(
            select(Profile).where(Profile.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def create(self, user_id: str, data: ProfileCreate) -> Profile:
        profile = Profile(user_id=user_id, **data.model_dump())
        self.db.add(profile)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile

    async def update(self, profile: Profile, data: ProfileUpdate) -> Profile:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(profile, field, value)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile
