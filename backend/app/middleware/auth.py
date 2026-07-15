"""
app/middleware/auth.py
Authentication dependency for FastAPI.
Supports: Clerk JWT (Bearer) and X-Api-Key header.
"""
import hashlib
import time
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

import jwt
import structlog
from fastapi import Depends, HTTPException, Header, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db

log = structlog.get_logger()

security = HTTPBearer(auto_error=False)

_key_usage_last_tracked: dict[str, float] = {}
_KEY_TRACK_THROTTLE_SEC = 60


@lru_cache(maxsize=1)
def _get_jwks_client() -> PyJWKClient:
    return PyJWKClient(settings.clerk_jwks_url, cache_jwk_set=True, lifespan=3600)


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _track_api_key_usage(api_key_row, user_id: str, tool_name: str, db: AsyncSession) -> None:
    from app.models.session import AISession
    key_id = str(api_key_row.id)
    now_mono = time.monotonic()
    last = _key_usage_last_tracked.get(key_id, 0.0)
    if now_mono - last < _KEY_TRACK_THROTTLE_SEC:
        return
    _key_usage_last_tracked[key_id] = now_mono
    try:
        api_key_row.last_used_at = _utcnow()
        db.add(api_key_row)
        result = await db.execute(
            select(AISession).where(AISession.user_id == user_id, AISession.tool_name == tool_name)
        )
        session_row = result.scalar_one_or_none()
        if session_row:
            session_row.last_used = _utcnow()
            db.add(session_row)
        else:
            db.add(AISession(user_id=user_id, tool_name=tool_name, last_used=_utcnow()))
        await db.commit()
    except Exception:
        await db.rollback()


async def _clerk_id_from_api_key(raw_key: str, db: AsyncSession, tool_name: str = "unknown") -> str:
    from app.models.api_key import ApiKey
    from app.models.user import User
    key_hash = _hash_key(raw_key)
    result = await db.execute(select(ApiKey).where(ApiKey.key_hash == key_hash))
    api_key_row = result.scalar_one_or_none()
    if not api_key_row:
        log.warning("auth_api_key_not_found")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    user_result = await db.execute(select(User).where(User.id == api_key_row.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        log.error("auth_api_key_owner_missing", api_key_id=str(api_key_row.id))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="API key owner not found")
    await _track_api_key_usage(api_key_row, api_key_row.user_id, tool_name, db)
    return user.clerk_id


async def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_api_key: Optional[str] = Header(default=None, alias="X-Api-Key"),
    x_tool_name: Optional[str] = Header(default=None, alias="X-Tool-Name"),
    db: AsyncSession = Depends(get_db),
) -> str:
    if x_api_key:
        return await _clerk_id_from_api_key(x_api_key, db, tool_name=x_tool_name or "unknown")

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required (Bearer token or X-Api-Key header)",
        )

    token = credentials.credentials
    # Unverified peek at the issuer claim only — used for diagnostics if verification
    # fails below, never trusted for auth decisions. Cheap way to catch the "frontend
    # publishable key and backend CLERK_JWKS_URL point at different Clerk instances"
    # class of bug: the token's iss won't match our configured JWKS host.
    token_iss = None
    try:
        token_iss = jwt.decode(token, options={"verify_signature": False}).get("iss")
    except Exception:
        pass

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
        log.debug("auth_token_expired", token_iss=token_iss)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except HTTPException:
        raise
    except Exception as exc:
        jwks_host = settings.clerk_jwks_url.split("/.well-known")[0] if settings.clerk_jwks_url else "NOT_SET"
        instance_mismatch = bool(token_iss) and jwks_host != "NOT_SET" and token_iss.rstrip("/") != jwks_host.rstrip("/")
        log.warning(
            "auth_jwt_validation_failed",
            error=str(exc),
            error_type=type(exc).__name__,
            jwks_host=jwks_host,
            token_iss=token_iss,
            likely_instance_mismatch=instance_mismatch,
        )
        # Never echo the raw exception (or Clerk's own error body) to the client —
        # only a generic, stable message. Full detail is in the server log above,
        # tagged with this request's X-Request-Id (see LoggingMiddleware).
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication credentials",
        )
