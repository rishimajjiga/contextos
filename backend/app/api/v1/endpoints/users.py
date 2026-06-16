"""
app/api/v1/endpoints/users.py
/api/v1/users — returns or provisions the current authenticated user.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware import get_current_user_id
from app.schemas import UserOut
from app.services import get_or_provision_user

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def get_current_user(
    clerk_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Returns the current user, provisioning a local record on first call."""
    user = await get_or_provision_user(db, clerk_id)
    return user
