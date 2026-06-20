"""
app/middleware/auth.py
Authentication dependency for FastAPI.

Supports two methods:
  1. Clerk JWT (Bearer token) — for the web app
  2. X-Api-Key header — for the MCP server and programmatic access

Both return the Clerk user ID (clerk_id / sub claim) so existing routes
that call get_or_provision_user(db, clerk_id) work unchanged.

When an API key is used, we also:
  - Update ApiKey.last_used_at
  - Upsert an AISession row so the dashboard can show which tools are connected
"""
import hashlib
import time
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Header, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db

security = HTTPBearer(auto_error=False)

# Throttle API-key usage tracking to at most once per minute per key
_key_usage_last_tracked: dict[str, float] = {}
_KEY_TRACK_THROTTLE_SEC = 60


@lru_cache(maxsize=1)
def _get_jwks_client() -> PyJWKClient:
    return PyJWKClient(settings.clerk_jwks_url, cache_jwk_set=True, lifespan=3600)


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _track_api_key_usage(
    api_key_row: "ApiKey",  # noqa: F821
    user_id: str,
    tool_name: str,
    db: AsyncSession,
) -> None:
    """
    Fire-and-forget tracking called after a successful API key auth.
    Updates last_used_at on the key and upserts an AISession row.
    Throttled to reduce DB writes from extension polling / typing suggestions.
    Errors here are non-fatal — we log and continue.
    """
    from app.models.session import AISession

    key_id = str(api_key_row.id)
    now_mono = time.monotonic()
    last = _key_usage_last_tracked.get(key_id, 0.0)
    if now_mono - last < _KEY_TRACK_THROTTLE_SEC:
        return
    _key_usage_last_tracked[key_id] = now_mono

    try:
        # 1. Stamp the API key
        api_key_row.last_used_at = _utcnow()
        db.add(api_key_row)

        # 2. Upsert AISession (user_id + tool_name is the natural key)
        result = await db.execute(
            select(AISession).where(
                AISession.user_id == user_id,
                AISession.tool_name == tool_name,
            )
        )
        session_row = result.scalar_one_or_none()
        if session_row:
            session_row.last_used = _utcnow()
            db.add(session_row)
        else:
            new_session = AISession(
                user_id=user_id,
                tool_name=tool_name,
                last_used=_utcnow(),
            )
            db.add(new_session)

        await db.commit()
    except Exception:
        # Tracking failure must never break the request
        await db.rollback()


async def _clerk_id_from_api_key(
    raw_key: str,
    db: AsyncSession,
    tool_name: str = "unknown",
) -> str:
    """
    Look up an API key → find the User → return their clerk_id.
    Also updates last_used_at and upserts AISession for session tracking.
    """
    from app.models.api_key import ApiKey
    from app.models.user import User

    key_hash = _hash_key(raw_key)
    result = await db.execute(select(ApiKey).where(ApiKey.key_hash == key_hash))
    api_key_row = result.scalar_one_or_none()
    if not api_key_row:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

    user_result = await db.execute(select(User).where(User.id == api_key_row.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key owner not found")

    # Track usage asynchronously — non-fatal if it fails
    await _track_api_key_usage(api_key_row, api_key_row.user_id, tool_name, db)

    return user.clerk_id


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_api_key: Optional[str] = Header(default=None, alias="X-Api-Key"),
    x_tool_name: Optional[str] = Header(default=None, alias="X-Tool-Name"),
    db: AsyncSession = Depends(get_db),
) -> str:
    """
    FastAPI dependency. Returns the Clerk user ID (sub claim / clerk_id).

    Priority:
      1. X-Api-Key header  → look up in DB, return clerk_id of the key owner
      2. Bearer JWT        → verify with Clerk JWKS, return sub claim

    When using an API key, X-Tool-Name is recorded so the dashboard can show
    which AI tools have connected (e.g. "contextos-mcp", "claude", "cursor").
    """
    # ── API key path ──────────────────────────────────────────────────────────
    if x_api_key:
        tool = x_tool_name or "unknown"
        return await _clerk_id_from_api_key(x_api_key, db, tool_name=tool)

    # ── Clerk JWT path ────────────────────────────────────────────────────────
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required (Bearer token or X-Api-Key header)",
        )

    token = credentials.credentials
    try:
        jwks_client = _get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        from datetime import timedelta
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
            leeway=timedelta(seconds=60),
        )
        clerk_id: Optional[str] = payload.get("sub")
        if not clerk_id:
            raise ValueError("sub claim missing")
        return clerk_id

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {exc}",
        )
