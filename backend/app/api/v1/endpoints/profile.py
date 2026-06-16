"""
app/api/v1/endpoints/profile.py
/api/v1/profile — Layer 1 (Identity) CRUD.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import ProfileCreate, ProfileOut, ProfileUpdate
from app.services import (
    create_profile,
    get_profile,
    update_profile,
)
from app.api.v1.dependencies import get_user_id

router = APIRouter()


@router.get("", response_model=ProfileOut)
async def read_profile(
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await get_profile(db, user_id)


@router.post("", response_model=ProfileOut, status_code=201)
async def create_profile_endpoint(
    data: ProfileCreate,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await create_profile(db, user_id, data)


@router.patch("", response_model=ProfileOut)
async def update_profile_endpoint(
    data: ProfileUpdate,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await update_profile(db, user_id, data)
