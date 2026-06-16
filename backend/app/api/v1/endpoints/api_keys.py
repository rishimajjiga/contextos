"""
app/api/v1/endpoints/api_keys.py
/api/v1/api-keys — generate, list, and revoke API keys for MCP / programmatic access.
"""
import hashlib
import secrets
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware import get_current_user_id
from app.models.api_key import ApiKey
from app.services import get_or_provision_user

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ApiKeyCreate(BaseModel):
    name: str  # e.g. "Claude Desktop", "Cursor"


class ApiKeyOut(BaseModel):
    id: str
    name: str
    key_prefix: str   # first 8 chars — shown in the list so user can identify it
    created_at: str

    model_config = {"from_attributes": True}


class ApiKeyCreated(ApiKeyOut):
    key: str  # full key — shown ONCE at creation, never again


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("", response_model=ApiKeyCreated, status_code=201)
async def create_api_key(
    data: ApiKeyCreate,
    clerk_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new API key. Returns the full key once — store it securely."""
    user = await get_or_provision_user(db, clerk_id)

    raw_key = "ctxos_" + secrets.token_hex(32)  # e.g. ctxos_<64 hex chars>
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:12]  # "ctxos_" + first 6 hex chars

    api_key = ApiKey(
        user_id=user.id,
        name=data.name,
        key_prefix=key_prefix,
        key_hash=key_hash,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)

    return ApiKeyCreated(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        created_at=str(api_key.created_at),
        key=raw_key,
    )


@router.get("", response_model=List[ApiKeyOut])
async def list_api_keys(
    clerk_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all API keys for the current user (key hashes are never returned)."""
    user = await get_or_provision_user(db, clerk_id)
    result = await db.execute(
        select(ApiKey).where(ApiKey.user_id == user.id).order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()
    return [
        ApiKeyOut(id=k.id, name=k.name, key_prefix=k.key_prefix, created_at=str(k.created_at))
        for k in keys
    ]


@router.delete("/{key_id}", status_code=204)
async def revoke_api_key(
    key_id: str,
    clerk_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Revoke (delete) an API key."""
    user = await get_or_provision_user(db, clerk_id)
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user.id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API key not found")
    await db.delete(key)
    await db.commit()
