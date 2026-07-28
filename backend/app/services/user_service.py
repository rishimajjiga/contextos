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
            if exc.response.status_code in (401, 403):
                log.error(
                    "clerk_api_unauthorized",
                    clerk_id=clerk_id,
                    status_code=exc.response.status_code,
                    clerk_response=exc.response.text,
                    hint="CLERK_SECRET_KEY is invalid, revoked, or belongs to a different Clerk "
                         "instance than the frontend's publishable key (e.g. test vs. live).",
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Server misconfiguration: Clerk rejected the backend's credentials. Check CLERK_SECRET_KEY env var.",
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


async def delete_clerk_identity(clerk_id: str) -> None:
    """Best-effort deletion of the user at Clerk, so the identity can no longer sign in.
    Called AFTER the local data deletion has committed — a Clerk hiccup must never leave
    the user's data half-deleted, and a dangling Clerk identity re-provisions only a fresh,
    empty account (never the deleted data). Failures are logged (ids only) and swallowed."""
    if not settings.clerk_secret_key or not clerk_id or clerk_id.startswith("deleted:"):
        return
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.delete(
                f"https://api.clerk.com/v1/users/{clerk_id}",
                headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
                timeout=10,
            )
            if resp.status_code in (200, 404):  # 404 = already gone at Clerk; fine
                log.info("account_deletion_clerk_identity_removed", clerk_id=clerk_id)
            else:
                log.warning(
                    "account_deletion_clerk_delete_failed",
                    clerk_id=clerk_id, status_code=resp.status_code,
                )
        except httpx.RequestError as exc:
            log.warning("account_deletion_clerk_unreachable", clerk_id=clerk_id, error=str(exc))


async def delete_account(db: AsyncSession, user_id: str) -> str | None:
    """Google Play / GDPR account deletion: permanently removes every piece of the user's
    personal data and content in one transaction.

    Deleted outright: memories/documents, projects, thread events, profile, API keys,
    device (push) tokens, AI-tool sessions, notification read-markers, support tickets,
    organizations the user OWNS (their members/invites cascade via FK), and the user's
    memberships in other organizations.

    Deliberately retained: Payment and UserSubscription rows — billing records kept for
    legal/accounting requirements (Razorpay holds the authoritative copies; nothing in
    these rows contains profile or content data). They FK the users row with CASCADE, so
    the row itself is kept but ANONYMIZED (email/name wiped, clerk_id replaced with a
    non-matching sentinel) — no personal data remains and no auth path can resolve to it.

    Returns the original clerk_id (for the follow-up Clerk identity deletion), or None if
    the user does not exist. Logs carry ids only — never email or content.
    """
    from sqlalchemy import delete as sql_delete, select

    from app.models.api_key import ApiKey
    from app.models.device_token import DeviceToken
    from app.models.document import Document
    from app.models.founder import NotificationRead, SupportTicket
    from app.models.organization import Organization, OrganizationInvite, OrganizationMember
    from app.models.profile import Profile
    from app.models.project import Project
    from app.models.session import AISession
    from app.models.thread_event import ThreadEvent

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        return None
    original_clerk_id = user.clerk_id

    await db.execute(sql_delete(ThreadEvent).where(ThreadEvent.user_id == user_id))
    await db.execute(sql_delete(Document).where(Document.user_id == user_id))
    await db.execute(sql_delete(Project).where(Project.user_id == user_id))
    await db.execute(sql_delete(ApiKey).where(ApiKey.user_id == user_id))
    await db.execute(sql_delete(DeviceToken).where(DeviceToken.user_id == user_id))
    await db.execute(sql_delete(AISession).where(AISession.user_id == user_id))
    await db.execute(sql_delete(NotificationRead).where(NotificationRead.user_id == user_id))
    await db.execute(sql_delete(SupportTicket).where(SupportTicket.user_id == user_id))
    await db.execute(sql_delete(Profile).where(Profile.user_id == user_id))
    await db.execute(sql_delete(OrganizationMember).where(OrganizationMember.user_id == user_id))
    await db.execute(sql_delete(Organization).where(Organization.owner_user_id == user_id))
    # Invites addressed to this user's email in OTHER orgs carry their address — remove those
    # too (invites in the user's own orgs are already gone with the org rows above).
    if user.email:
        await db.execute(sql_delete(OrganizationInvite).where(OrganizationInvite.email == user.email))

    user.email = f"deleted-{user.id}@deleted.invalid"
    user.name = ""
    user.clerk_id = f"deleted:{user.id}"

    await db.commit()
    log.info("account_deleted", user_id=user_id)
    return original_clerk_id
