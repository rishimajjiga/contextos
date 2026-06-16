"""
app/services/profile_service.py
"""
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Profile
from app.repositories import ProfileRepository
from app.schemas import ProfileCreate, ProfileUpdate


async def get_profile(db: AsyncSession, user_id: str) -> Profile:
    repo = ProfileRepository(db)
    profile = await repo.get_by_user_id(user_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found. Create one first.",
        )
    return profile


async def create_profile(
    db: AsyncSession, user_id: str, data: ProfileCreate
) -> Profile:
    repo = ProfileRepository(db)
    existing = await repo.get_by_user_id(user_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Profile already exists. Use PATCH to update it.",
        )
    return await repo.create(user_id=user_id, data=data)


async def update_profile(
    db: AsyncSession, user_id: str, data: ProfileUpdate
) -> Profile:
    profile = await get_profile(db, user_id)
    repo = ProfileRepository(db)
    return await repo.update(profile=profile, data=data)
