"""
app/services/user_service.py
Business logic for user provisioning.
Called on every authenticated request to ensure the local users row exists.
"""
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.repositories import UserRepository
from app.config import settings


async def _fetch_clerk_user(clerk_id: str) -> dict:
    """Fetch user details from Clerk's REST API."""
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(
                f"https://api.clerk.com/v1/users/{clerk_id}",
                headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
                timeout=10,
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPStatusError as exc:
            from fastapi import HTTPException, status
            if exc.response.status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Server misconfiguration: invalid Clerk secret key. Check CLERK_SECRET_KEY env var.",
                ) from exc
            # Other Clerk errors — fall through with empty data so we can still provision
            return {}
        except httpx.RequestError:
            # Clerk unreachable — fall through with empty data
            return {}


async def get_or_provision_user(
    db: AsyncSession, clerk_id: str
) -> User:
    """
    Ensures a local users row exists for this Clerk user.
    On first call we fetch name + email from Clerk; subsequent calls are a no-op.
    """
    repo = UserRepository(db)
    user = await repo.get_by_clerk_id(clerk_id)
    if user:
        return user

    # First visit — provision from Clerk
    clerk_data = await _fetch_clerk_user(clerk_id)
    email_objs = clerk_data.get("email_addresses", [])
    email = email_objs[0]["email_address"] if email_objs else ""
    first = clerk_data.get("first_name") or ""
    last = clerk_data.get("last_name") or ""
    name = f"{first} {last}".strip() or email.split("@")[0]

    user, _ = await repo.get_or_create(clerk_id=clerk_id, email=email, name=name)
    return user
