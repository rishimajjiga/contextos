"""
app/api/v1/endpoints/search.py
/api/v1/search — Semantic search over the user's knowledge base.
"""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas import SearchRequest, SearchResultItem
from app.services import semantic_search
from app.api.v1.dependencies import get_user_id

router = APIRouter()


@router.post("", response_model=List[SearchResultItem])
async def search_endpoint(
    request: SearchRequest,
    user_id: str = Depends(get_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Keyword search over all knowledge (documents, notes, code snippets).
    Results are ranked by recency when multiple match.
    """
    return await semantic_search(db, user_id, request)
