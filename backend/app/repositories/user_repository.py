"""
app/repositories/user_repository.py
All database operations for the User model.
"""
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_clerk_id(self, clerk_id: str) -> Optional[User]:
        result = await self.db.execute(
            select(User).where(User.clerk_id == clerk_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: str) -> Optional[User]:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def create(self, clerk_id: str, email: str, name: str) -> User:
        user = User(clerk_id=clerk_id, email=email, name=name)
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get_or_create(
        self, clerk_id: str, email: str, name: str
    ) -> tuple[User, bool]:
        """Return (user, created) — creates if not exists."""
        user = await self.get_by_clerk_id(clerk_id)
        if user:
            return user, False
        user = await self.create(clerk_id, email, name)
        return user, True
