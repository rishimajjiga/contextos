"""
app/repositories/document_repository.py
MVP: CRUD + keyword search. Vector search removed.
"""
from typing import List, Optional
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document
from app.schemas import DocumentCreate, DocumentUpdate


class DocumentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_by_user(
        self,
        user_id: str,
        page: int = 1,
        per_page: int = 20,
        project_id: Optional[str] = None,
    ) -> tuple[list[Document], int]:
        offset = (page - 1) * per_page
        base_filter = [Document.user_id == user_id]
        if project_id:
            base_filter.append(Document.project_id == project_id)

        count_q = await self.db.execute(
            select(func.count()).select_from(Document).where(*base_filter)
        )
        total = count_q.scalar_one()

        result = await self.db.execute(
            select(Document)
            .where(*base_filter)
            .order_by(Document.updated_at.desc())
            .offset(offset)
            .limit(per_page)
        )
        return result.scalars().all(), total  # type: ignore[return-value]

    async def get(self, doc_id: str, user_id: str) -> Optional[Document]:
        result = await self.db.execute(
            select(Document).where(
                Document.id == doc_id, Document.user_id == user_id
            )
        )
        return result.scalar_one_or_none()

    async def create(self, user_id: str, data: DocumentCreate) -> Document:
        doc = Document(user_id=user_id, **data.model_dump())
        self.db.add(doc)
        await self.db.commit()
        await self.db.refresh(doc)
        return doc

    async def update(self, doc: Document, data: DocumentUpdate) -> Document:
        for field, value in data.model_dump(exclude_none=True).items():
            setattr(doc, field, value)
        await self.db.commit()
        await self.db.refresh(doc)
        return doc

    async def delete(self, doc: Document) -> None:
        await self.db.delete(doc)
        await self.db.commit()

    async def keyword_search(
        self,
        user_id: str,
        query: str,
        limit: int = 10,
        project_id: Optional[str] = None,
        doc_types: Optional[List[str]] = None,
    ) -> List[Document]:
        """
        Multi-word ILIKE search on title + content.
        Splits the query into individual words and requires ALL of them to appear
        (each word can match title OR content independently).
        Falls back to whole-phrase search if no usable words found.
        """
        # Split into meaningful words (≥2 chars), cap at 6 to avoid huge queries
        words = [w for w in query.split() if len(w) >= 2][:6]

        conditions: list = [Document.user_id == user_id]

        if words:
            # Every word must appear somewhere in title or content (AND across words)
            for word in words:
                p = f"%{word}%"
                conditions.append(
                    or_(
                        Document.title.ilike(p),
                        Document.content.ilike(p),
                    )
                )
        else:
            # Whole-phrase fallback
            p = f"%{query}%"
            conditions.append(
                or_(
                    Document.title.ilike(p),
                    Document.content.ilike(p),
                )
            )

        if project_id:
            conditions.append(Document.project_id == project_id)
        if doc_types:
            conditions.append(Document.doc_type.in_(doc_types))

        result = await self.db.execute(
            select(Document)
            .where(*conditions)
            .order_by(Document.updated_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def keyword_search_team(
        self,
        team_member_ids: List[str],
        query: str,
        limit: int = 5,
        doc_types: Optional[List[str]] = None,
    ) -> List[Document]:
        """
        Search visibility='team' documents belonging to other org members.
        Same AND-per-word logic as keyword_search.
        """
        if not team_member_ids:
            return []

        words = [w for w in query.split() if len(w) >= 2][:6]

        conditions: list = [
            Document.user_id.in_(team_member_ids),
            Document.visibility == "team",
        ]

        if words:
            for word in words:
                p = f"%{word}%"
                conditions.append(
                    or_(
                        Document.title.ilike(p),
                        Document.content.ilike(p),
                    )
                )
        else:
            p = f"%{query}%"
            conditions.append(
                or_(
                    Document.title.ilike(p),
                    Document.content.ilike(p),
                )
            )

        if doc_types:
            conditions.append(Document.doc_type.in_(doc_types))

        result = await self.db.execute(
            select(Document)
            .where(*conditions)
            .order_by(Document.updated_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
