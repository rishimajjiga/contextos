"""
app/services/document_service.py
Handles document creation and file uploads.
MVP: no embeddings — keyword search only.
"""
import io
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Document
from app.repositories import DocumentRepository
from app.schemas import (
    DocumentCreate,
    DocumentUpdate,
    PaginatedDocuments,
    DocumentOut,
)

# Lazy-load Supabase client
_supabase_client = None


def _get_supabase():
    global _supabase_client
    if _supabase_client is None:
        from supabase import create_client
        _supabase_client = create_client(
            settings.supabase_url, settings.supabase_service_key
        )
    return _supabase_client


async def list_documents(
    db: AsyncSession,
    user_id: str,
    page: int,
    per_page: int,
    project_id: Optional[str] = None,
    view_limit: int = -1,
) -> PaginatedDocuments:
    repo = DocumentRepository(db)
    docs, total = await repo.list_by_user(user_id, page, per_page, project_id)

    # If the plan caps how many memories are visible, slice to the most recent N.
    # Data is never deleted — upgrading restores full access automatically.
    if view_limit != -1 and total > view_limit:
        # Only return docs within the view_limit window (most recent first)
        all_docs_result = await repo.list_by_user(user_id, 1, view_limit, project_id)
        capped_docs, _ = all_docs_result
        visible_ids = {d.id for d in capped_docs}
        docs = [d for d in docs if d.id in visible_ids]
        total = view_limit

    has_next = (page * per_page) < total
    return PaginatedDocuments(
        items=[DocumentOut.model_validate(d) for d in docs],
        total=total,
        page=page,
        per_page=per_page,
        has_next=has_next,
    )


async def get_document(db: AsyncSession, doc_id: str, user_id: str) -> Document:
    repo = DocumentRepository(db)
    doc = await repo.get(doc_id, user_id)
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")
    return doc


async def create_document(
    db: AsyncSession, user_id: str, data: DocumentCreate
) -> Document:
    repo = DocumentRepository(db)
    return await repo.create(user_id=user_id, data=data)


async def update_document(
    db: AsyncSession, doc_id: str, user_id: str, data: DocumentUpdate
) -> Document:
    doc = await get_document(db, doc_id, user_id)
    repo = DocumentRepository(db)
    return await repo.update(doc=doc, data=data)


async def delete_document(db: AsyncSession, doc_id: str, user_id: str) -> None:
    doc = await get_document(db, doc_id, user_id)
    repo = DocumentRepository(db)
    await repo.delete(doc)


async def upload_file_document(
    db: AsyncSession,
    user_id: str,
    file: UploadFile,
    project_id: Optional[str] = None,
) -> Document:
    """Upload a file to Supabase Storage, extract text, create a Document record."""
    if file.size and file.size > 20 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum 20 MB.",
        )

    content_bytes = await file.read()
    filename = file.filename or "upload"
    content_type = file.content_type or "application/octet-stream"

    doc_type = "other"
    if content_type == "application/pdf":
        doc_type = "pdf"
    elif content_type.startswith("text/"):
        doc_type = "note"

    # Upload to Supabase Storage
    storage_path = f"{user_id}/{filename}"
    supabase = _get_supabase()
    supabase.storage.from_(settings.supabase_bucket).upload(
        storage_path,
        content_bytes,
        file_options={"content-type": content_type},
    )
    file_url = (
        f"{settings.supabase_url}/storage/v1/object/public/"
        f"{settings.supabase_bucket}/{storage_path}"
    )

    text_content = await _extract_text(content_bytes, content_type)

    create_data = DocumentCreate(
        title=filename,
        content=text_content,
        doc_type=doc_type,  # type: ignore[arg-type]
        project_id=project_id,
        tags=[],
    )
    repo = DocumentRepository(db)
    doc = await repo.create(user_id=user_id, data=create_data)
    doc.file_url = file_url
    await db.commit()
    await db.refresh(doc)
    return doc


async def _extract_text(content_bytes: bytes, content_type: str) -> str:
    if content_type == "application/pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content_bytes))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            return ""
    try:
        return content_bytes.decode("utf-8", errors="replace")
    except Exception:
        return ""
