"""
app/api/v1/endpoints/native_session.py
Bridges a native Android Clerk session into a web (cookie-based) Clerk session.

Clerk's native Android SDK (used for in-app Google sign-in, since Google blocks its
consent screen from rendering in any embedded WebView) and the WebView showing this
site never share cookies or storage — that's an OS-level sandboxing rule, not
something app code can work around. This endpoint mints a one-time Clerk sign-in
token for the caller's own verified identity; the Android app hands that token to
the WebView, which exchanges it for a real web session via
`signIn.create({ strategy: "ticket", ticket })`.
"""
import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.middleware import get_current_user_id

log = structlog.get_logger()

router = APIRouter()


@router.post("/native-ticket")
async def create_native_sign_in_ticket(clerk_id: str = Depends(get_current_user_id)) -> dict:
    """Mints a one-time Clerk sign-in token for the caller's own verified identity.

    The caller must already hold a valid Clerk session JWT (enforced by
    get_current_user_id, which verifies it against Clerk's JWKS) — this never
    accepts a bare user_id from the client, so it can't be used to mint a ticket
    for anyone but the already-authenticated caller.
    """
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.post(
                "https://api.clerk.com/v1/sign_in_tokens",
                headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
                # Short expiry — this is consumed within seconds of creation, immediately
                # after the native sign-in that produced the caller's session JWT.
                json={"user_id": clerk_id, "expires_in_seconds": 60},
                timeout=10,
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            log.error(
                "native_ticket_clerk_error",
                clerk_id=clerk_id,
                status_code=exc.response.status_code,
                body=exc.response.text,
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not create sign-in ticket",
            ) from exc
        except httpx.RequestError as exc:
            log.error("native_ticket_clerk_unreachable", clerk_id=clerk_id, error=str(exc))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Clerk API unreachable",
            ) from exc

    data = resp.json()
    return {"ticket": data.get("token")}
