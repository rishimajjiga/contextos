"""
app/services/org_service.py
Team / organization business logic.
"""
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.organization import Organization, OrganizationInvite, OrganizationMember
from app.models.user import User
from app.services.subscription_service import get_user_plan

MAX_SEATS = 5  # Team plan: owner + 4 members


# ── Org helpers ───────────────────────────────────────────────────────────────

async def get_org_for_user(db: AsyncSession, user_id: str) -> Organization | None:
    """Return the org the user belongs to (as owner or member), or None."""
    result = await db.execute(
        select(Organization)
        .join(OrganizationMember, OrganizationMember.org_id == Organization.id)
        .where(OrganizationMember.user_id == user_id)
        .options(
            selectinload(Organization.members).selectinload(OrganizationMember.user)
        )
    )
    return result.scalar_one_or_none()


async def require_team_plan(db: AsyncSession, user_id: str) -> None:
    plan = await get_user_plan(db, user_id)
    # Founder accounts have all premium/team features.
    if plan not in ("team", "founder"):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "TEAM_PLAN_REQUIRED",
                "message": "Team features require the Team plan. Upgrade to create an organization.",
            },
        )


# ── Create org ────────────────────────────────────────────────────────────────

async def create_organization(db: AsyncSession, owner_user_id: str, name: str) -> Organization:
    await require_team_plan(db, owner_user_id)

    # One org per user
    existing = await db.execute(
        select(Organization).where(Organization.owner_user_id == owner_user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have an organization.")

    org = Organization(name=name, owner_user_id=owner_user_id)
    db.add(org)
    await db.flush()  # get org.id

    # Owner is automatically a member
    member = OrganizationMember(org_id=org.id, user_id=owner_user_id, role="owner")
    db.add(member)
    await db.commit()

    # Re-fetch with user info loaded so the endpoint can return names/emails
    return await get_org_for_user(db, owner_user_id)


# ── Invite ────────────────────────────────────────────────────────────────────

async def create_invite(
    db: AsyncSession, org_id: str, inviter_user_id: str, email: str
) -> OrganizationInvite:
    # Seat limit check
    count_result = await db.execute(
        select(OrganizationMember).where(OrganizationMember.org_id == org_id)
    )
    current_count = len(count_result.scalars().all())
    if current_count >= MAX_SEATS:
        raise HTTPException(
            status_code=400,
            detail=f"Team is full ({MAX_SEATS} seats). Remove a member to invite someone new.",
        )

    # Expire any existing pending invite for this email
    existing = await db.execute(
        select(OrganizationInvite).where(
            OrganizationInvite.org_id == org_id,
            OrganizationInvite.email == email,
            OrganizationInvite.status == "pending",
        )
    )
    for old in existing.scalars().all():
        old.status = "expired"

    invite = OrganizationInvite(
        org_id=org_id,
        email=email,
        invited_by_user_id=inviter_user_id,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)
    return invite


# ── Join via token ────────────────────────────────────────────────────────────

async def accept_invite(db: AsyncSession, token: str, user_id: str) -> Organization:
    result = await db.execute(
        select(OrganizationInvite).where(OrganizationInvite.token == token)
    )
    invite = result.scalar_one_or_none()

    if invite is None:
        raise HTTPException(status_code=404, detail="Invite not found.")
    if invite.status != "pending":
        raise HTTPException(status_code=400, detail="This invite has already been used or expired.")
    if invite.expires_at < datetime.now(timezone.utc):
        invite.status = "expired"
        await db.commit()
        raise HTTPException(status_code=400, detail="This invite link has expired.")

    # Check if already a member
    already = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == invite.org_id,
            OrganizationMember.user_id == user_id,
        )
    )
    if already.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You are already a member of this organization.")

    member = OrganizationMember(org_id=invite.org_id, user_id=user_id, role="member")
    db.add(member)
    invite.status = "accepted"
    await db.commit()

    org_result = await db.execute(
        select(Organization).where(Organization.id == invite.org_id)
    )
    return org_result.scalar_one()


# ── Remove member ─────────────────────────────────────────────────────────────

async def remove_member(
    db: AsyncSession, org_id: str, owner_user_id: str, member_user_id: str
) -> None:
    if owner_user_id == member_user_id:
        raise HTTPException(status_code=400, detail="Owner cannot remove themselves.")

    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == member_user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found.")

    await db.delete(member)
    await db.commit()


# ── Pending invites ───────────────────────────────────────────────────────────

async def get_pending_invites(db: AsyncSession, org_id: str) -> list[OrganizationInvite]:
    """Return all pending (non-expired, non-accepted) invites for the org."""
    result = await db.execute(
        select(OrganizationInvite)
        .where(
            OrganizationInvite.org_id == org_id,
            OrganizationInvite.status == "pending",
        )
        .order_by(OrganizationInvite.created_at.desc())
    )
    return list(result.scalars().all())


async def revoke_invite(db: AsyncSession, token: str, owner_user_id: str) -> None:
    """Mark a pending invite as expired. Owner-only."""
    result = await db.execute(
        select(OrganizationInvite).where(OrganizationInvite.token == token)
    )
    invite = result.scalar_one_or_none()
    if invite is None:
        raise HTTPException(status_code=404, detail="Invite not found.")

    # Verify the caller owns the org this invite belongs to
    org_result = await db.execute(
        select(Organization).where(Organization.id == invite.org_id)
    )
    org = org_result.scalar_one_or_none()
    if not org or org.owner_user_id != owner_user_id:
        raise HTTPException(status_code=403, detail="Only the org owner can revoke invites.")

    invite.status = "expired"
    await db.commit()


# ── Get team member user IDs ──────────────────────────────────────────────────

async def get_org_member_user_ids(db: AsyncSession, org_id: str) -> list[str]:
    result = await db.execute(
        select(OrganizationMember.user_id).where(OrganizationMember.org_id == org_id)
    )
    return list(result.scalars().all())
