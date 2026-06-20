"""
app/services/user_service.py
Business logic for user provisioning.
Called on every authenticated request to ensure the local users row exists.
"""
import httpx
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.repositories import UserRepository
from app.config import settings

log = structlog.get_logger()


async def _fetch_clerk_user(clerk_id: str) -> dict:
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
                log.error(
                    "clerk_api_invalid_secret_key",
                    clerk_id=clerk_id,
                    hint="Check CLERK_SECRET_KEY env var (sk_live_... or sk_test_...)",
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Server misconfiguration: invalid Clerk secret key. Check CLERK_SECRET_KEY env var.",
                ) from exc
            log.warning("clerk_api_error_on_provision", clerk_id=clerk_id, status_code=exc.response.status_code)
            return {}
        except httpx.RequestError as exc:
            log.warning("clerk_api_unreachable", clerk_id=clerk_id, error=str(exc))
            return {}


async def get_or_provision_user(db: AsyncSession, clerk_id: str) -> User:
    repo = UserRepository(db)
    user = await repo.get_by_clerk_id(clerk_id)
    if user:
        return user

    clerk_data = await _fetch_clerk_user(clerk_id)
    email_objs = clerk_data.get("email_addresses", [])
    email = email_objs[0]["email_address"] if email_objs else ""
    first = clerk_data.get("first_name") or ""
    last = clerk_data.get("last_name") or ""
    name = f"{first} {last}".strip() or email.split("@")[0]

    user, created = await repo.get_or_create(clerk_id=clerk_id, email=email, name=name)
    if created:
        log.info("user_provisioned", clerk_id=clerk_id, email=email)
    return user
