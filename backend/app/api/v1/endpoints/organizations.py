"""
app/api/v1/endpoints/organizations.py
Team / organization management endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

import os
from app.database import get_db
from app.api.v1.dependencies import get_user_id
from app.services import org_service

router = APIRouter()


# Schemas

class CreateOrgRequest(BaseModel):
    name: str


class InviteRequest(BaseModel):
    email: str


class OrgMemberOut(BaseModel):
    user_id: str
    role: str
    name: str = ""
    email: str = ""


class OrgOut(BaseModel):
    id: str
    name: str
    owner_user_id: str
    members: list[OrgMemberOut]


class InviteOut(BaseModel):
    token: str
    email: str
    status: str
    invite_url: str
    expires_at: str


def _frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:5173")


def _serialize_org(org) -> dict:
    """Build OrgOut dict with member names/emails from loaded user relationships."""
    return {
        "id": org.id,
        "name": org.name,
        "owner_user_id": org.owner_user_id,
        "members": [
            {
                "user_id": m.user_id,
                "role": m.role,
                "name": m.user.name if m.user else "",
                "email": m.user.email if m.user else "",
            }
            for m in org.members
        ],
    }


def _serialize_invite(invite, frontend_url: str) -> dict:
    return {
        "token": invite.token,
        "email": invite.email,
        "status": invite.status,
        "invite_url": f"{frontend_url}/join/{invite.token}",
        "expires_at": invite.expires_at.isoformat(),
    }


# Endpoints

@router.get("", response_model=OrgOut | None)
async def get_my_org(
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Return the org this user belongs to (or null if none)."""
    org = await org_service.get_org_for_user(db, user_id)
    if org is None:
        return None
    return _serialize_org(org)


@router.post("", response_model=OrgOut, status_code=201)
async def create_org(
    body: CreateOrgRequest,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new organization. Requires Team plan."""
    org = await org_service.create_organization(db, user_id, body.name)
    return _serialize_org(org)


@router.get("/invites", response_model=list[InviteOut])
async def list_pending_invites(
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all pending invites for the caller's org. Owner only."""
    org = await org_service.get_org_for_user(db, user_id)
    if not org:
        raise HTTPException(status_code=404, detail="You don't have an organization.")
    if org.owner_user_id != user_id:
        raise HTTPException(status_code=403, detail="Only the org owner can view invites.")
    invites = await org_service.get_pending_invites(db, org.id)
    frontend = _frontend_url()
    return [_serialize_invite(i, frontend) for i in invites]


@router.post("/invite", response_model=InviteOut)
async def invite_member(
    body: InviteRequest,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create an invite link for the given email. Owner only."""
    org = await org_service.get_org_for_user(db, user_id)
    if not org:
        raise HTTPException(status_code=404, detail="You don't have an organization.")
    if org.owner_user_id != user_id:
        raise HTTPException(status_code=403, detail="Only the org owner can invite members.")
    invite = await org_service.create_invite(db, org.id, user_id, body.email)
    return _serialize_invite(invite, _frontend_url())


@router.delete("/invites/{token}", status_code=204)
async def revoke_invite(
    token: str,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a pending invite. Owner only."""
    await org_service.revoke_invite(db, token, user_id)


@router.post("/join/{token}", response_model=OrgOut)
async def join_org(
    token: str,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Accept an invite token and join the organization."""
    await org_service.accept_invite(db, token, user_id)
    return await org_service.get_org_for_user(db, user_id)


@router.delete("/members/{member_user_id}", status_code=204)
async def remove_member(
    member_user_id: str,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member from your org. Owner only."""
    org = await org_service.get_org_for_user(db, user_id)
    if not org:
        raise HTTPException(status_code=404, detail="You don't have an organization.")
    if org.owner_user_id != user_id:
        raise HTTPException(status_code=403, detail="Only the org owner can remove members.")

    await org_service.remove_member(db, org.id, user_id, member_user_id)
