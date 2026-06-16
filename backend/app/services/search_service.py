"""
app/services/search_service.py
Keyword (ILIKE) search on title + content.
Also searches teammates' shared (visibility='team') documents when the user is in an org.
similarity is left as None here; it will be a real cosine score once
pgvector is added. The frontend hides the score when it is absent.
"""
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import DocumentRepository
from app.schemas import SearchRequest, SearchResultItem


def _doc_to_result(doc, shared: bool = False) -> SearchResultItem:
    return SearchResultItem(
        id=doc.id,
        type="document",
        title=f"[Team] {doc.title}" if shared else doc.title,
        content=doc.content,
        similarity=None,
        project_id=doc.project_id,
        project_name=None,
        doc_type=doc.doc_type,
        created_at=doc.created_at.isoformat(),
    )


async def semantic_search(
    db: AsyncSession, user_id: str, request: SearchRequest
) -> List[SearchResultItem]:
    repo = DocumentRepository(db)
    doc_types = list(request.doc_types) if request.doc_types else None

    # Own documents
    own_docs = await repo.keyword_search(
        user_id=user_id,
        query=request.query,
        limit=request.limit,
        project_id=request.project_id,
        doc_types=doc_types,
    )

    # Team documents (best-effort — silently skip if user has no org)
    team_docs: list = []
    try:
        from app.services.org_service import get_org_for_user, get_org_member_user_ids
        org = await get_org_for_user(db, user_id)
        if org:
            member_ids = await get_org_member_user_ids(db, org.id)
            other_ids = [uid for uid in member_ids if uid != user_id]
            if other_ids:
                team_docs = await repo.keyword_search_team(
                    team_member_ids=other_ids,
                    query=request.query,
                    limit=5,
                    doc_types=doc_types,
                )
    except Exception:
        pass

    # Deduplicate by id (own docs take priority)
    seen = {doc.id for doc in own_docs}
    merged = [_doc_to_result(d) for d in own_docs]
    for d in team_docs:
        if d.id not in seen:
            merged.append(_doc_to_result(d, shared=True))
            seen.add(d.id)

    return merged
