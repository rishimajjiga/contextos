"""
app/api/v1/endpoints/users.py
/api/v1/users — returns or provisions the current authenticated user, and
exports all of the user's own data as a downloadable PDF.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware import get_current_user_id
from app.schemas import UserOut
from app.services import get_or_provision_user
from app.api.v1.dependencies import get_user_id

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def get_current_user(
    clerk_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Returns the current user, provisioning a local record on first call."""
    user = await get_or_provision_user(db, clerk_id)
    return user


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
