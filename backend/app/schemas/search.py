from typing import List, Literal, Optional
from pydantic import BaseModel, Field

DocumentType = Literal["note", "pdf", "code", "research", "other"]


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    limit: int = Field(default=10, ge=1, le=50)
    project_id: Optional[str] = None
    doc_types: Optional[List[DocumentType]] = None


class SearchResultItem(BaseModel):
    id: str
    type: Literal["document", "project"]
    title: str
    content: str
    # None when using keyword search; a real 0-1 score when vector search is active.
    similarity: Optional[float] = None
    project_id: Optional[str]
    project_name: Optional[str]
    doc_type: Optional[str]
    created_at: str
