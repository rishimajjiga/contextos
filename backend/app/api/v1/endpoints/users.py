"""
app/api/v1/endpoints/users.py
/api/v1/users — returns or provisions the current authenticated user, and
exports all of the user's own data as a downloadable PDF.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware import get_current_user_id
from app.schemas import UserOut
from app.services import get_or_provision_user
from app.api.v1.dependencies import get_user_id, get_user_id_no_purge

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def get_current_user(
    clerk_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Returns the current user, provisioning a local record on first call."""
    user = await get_or_provision_user(db, clerk_id)
    return user


class AccountDeleteRequest(BaseModel):
    # The literal string "DELETE", typed/confirmed by the user in the UI. A structural
    # guard against accidental calls — no client can wipe an account with an empty POST.
    confirm: str


@router.post("/me/delete")
async def delete_my_account(
    body: AccountDeleteRequest,
    user_id: str = Depends(get_user_id_no_purge),
    db: AsyncSession = Depends(get_db),
):
    """Google Play / GDPR account deletion — permanently deletes the authenticated
    user's account and personal data. Scoped strictly to the verified credential's own
    account; there is no way to name another user. Uses the no-purge auth dependency so
    an account whose grace period expired can still exercise its right to deletion.

    POST rather than DELETE because the confirmation must travel in the body, and
    intermediaries are allowed to drop DELETE request bodies (RFC 9110 §9.3.5).

    Payment/subscription records are retained for legal/billing requirements, attached
    to an anonymized shell — see user_service.delete_account for the exact inventory.
    """
    if body.confirm != "DELETE":
        raise HTTPException(
            status_code=400,
            detail='Confirmation required: send {"confirm": "DELETE"} to permanently delete this account.',
        )
    from app.services import user_service

    clerk_id = await user_service.delete_account(db, user_id)
    if clerk_id is None:
        raise HTTPException(status_code=404, detail="Account not found.")
    # After the local commit: remove the Clerk identity so sign-in stops working.
    # Best-effort by design — see delete_clerk_identity.
    await user_service.delete_clerk_identity(clerk_id)
    return {"ok": True, "message": "Your account and personal data have been permanently deleted."}


@router.get("/export-data")
async def export_data(
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Download Your Data — export every memory and project owned by the
    authenticated user as a professionally formatted PDF.

    The PDF is scoped strictly to ``user_id`` (resolved from the verified
    credential), so a caller can only ever download their own data. The
    response is returned as an attachment so the browser downloads it.
    """
    from app.services.backup_service import generate_pdf_bytes

    pdf_bytes = await generate_pdf_bytes(db, user_id)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="contextos-data-export-{stamp}.pdf"',
            "Content-Length": str(len(pdf_bytes)),
            "Cache-Control": "no-store",
        },
    )
