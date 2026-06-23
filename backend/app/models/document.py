"""
app/models/document.py
Note/memory model — stores plain-text notes in the existing documents table.
No file uploads, no embeddings, no vector search in MVP.
"""
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from .base import UUIDMixin, TimestampMixin
from .types import ArrayOfString


class Document(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "documents"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )
    # Set when this is a TEAM memory (visibility="team"); links it to the org so
    # all current org members can see it. NULL for private memories.
    org_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    doc_type: Mapped[str] = mapped_column(String(50), nullable=False, default="note")
    tags: Mapped[list[str]] = mapped_column(ArrayOfString, nullable=False, default=list)
    visibility: Mapped[str] = mapped_column(String(20), nullable=False, default="private")

    def __repr__(self) -> str:
        return f"<Document id={self.id} title={self.title!r}>"
