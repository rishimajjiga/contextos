from datetime import datetime
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

DocumentType = Literal["note", "pdf", "code", "research", "other"]


class DocumentCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=512)
    content: str = ""
    doc_type: DocumentType = "note"
    project_id: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class DocumentUpdate(BaseModel):
    title: str | None = Field(None, max_length=512)
    content: str | None = None
    doc_type: DocumentType | None = None
    project_id: Optional[str] = None
    tags: List[str] | None = None
    visibility: Literal["private", "team"] | None = None


class DocumentOut(BaseModel):
    id: str
    user_id: str
    project_id: Optional[str]
    title: str
    content: str
    doc_type: str
    file_url: Optional[str]
    tags: List[str]
    visibility: str = "private"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaginatedDocuments(BaseModel):
    items: List[DocumentOut]
    total: int
    page: int
    per_page: int
    has_next: bool
