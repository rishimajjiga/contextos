"""
app/api/v1/endpoints/documents.py
/api/v1/documents — Layer 3 (Knowledge) CRUD + file upload.
"""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import DocumentCreate, DocumentOut, DocumentUpdate, PaginatedDocuments
from app.services import (
    create_document,
    delete_document,
    get_document,
    list_documents,
    update_document,
    upload_file_document,
)
from app.api.v1.dependencies import get_user_id
from app.services.subscription_service import check_document_limit, get_user_plan, PLAN_LIMITS
from app.services.thread_event_service import log_thread_event

router = APIRouter()


@router.get("", response_model=PaginatedDocuments)
async def list_documents_endpoint(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    page_size: Optional[int] = Query(default=None, ge=1, le=100),
    project_id: Optional[str] = Query(default=None),
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    effective_per_page = page_size if page_size is not None else per_page
    plan = await get_user_plan(db, user_id)
    view_limit = PLAN_LIMITS[plan]["documents"]
    return await list_documents(db, user_id, page, effective_per_page, project_id, view_limit=view_limit)


@router.get("/{doc_id}", response_model=DocumentOut)
async def get_document_endpoint(
    doc_id: str,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await get_document(db, doc_id, user_id)


@router.post("", response_model=DocumentOut, status_code=201)
async def create_document_endpoint(
    data: DocumentCreate,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    await check_document_limit(db, user_id)
    doc = await create_document(db, user_id, data)
    if doc.project_id:
        try:
            await log_thread_event(
                db,
                project_id=doc.project_id,
                user_id=user_id,
                event_type="document_added",
                title='Note added: "' + doc.title + '"',
                detail=doc.content[:200] if doc.content else "",
            )
        except Exception:
            pass  # thread event logging is non-fatal
    return doc


@router.post("/upload", response_model=DocumentOut, status_code=201)
async def upload_document_endpoint(
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(default=None),
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file (PDF, text, code). Extracts text and stores it."""
    await check_document_limit(db, user_id)
    doc = await upload_file_document(db, user_id, file, project_id)
    if project_id:
        try:
            await log_thread_event(
                db,
                project_id=project_id,
                user_id=user_id,
                event_type="file_uploaded",
                title='File uploaded: "' + doc.title + '"',
                detail="Type: " + doc.doc_type,
            )
        except Exception:
            pass  # thread event logging is non-fatal
    return doc


@router.patch("/{doc_id}", response_model=DocumentOut)
async def update_document_endpoint(
    doc_id: str,
    data: DocumentUpdate,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    return await update_document(db, doc_id, user_id, data)


@router.delete("/{doc_id}", status_code=204)
async def delete_document_endpoint(
    doc_id: str,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    await delete_document(db, doc_id, user_id)
