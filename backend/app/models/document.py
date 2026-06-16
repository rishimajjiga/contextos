"""
app/models/document.py
Layer 3 — Knowledge.  Notes, PDFs, code snippets, research.
MVP: no vector embedding — keyword search only.
"""
from typing import Optional

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from .base import UUIDMixin, TimestampMixin
from .types import ArrayOfString


class Document(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "documents"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True
    )

    title: Mapped[str] = mapped_column(String(512), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    doc_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="note"
    )  # note | pdf | code | research | other
    file_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    tags: Mapped[list[str]] = mapped_column(ArrayOfString, nullable=False, default=list)
    # "private" = only owner sees it | "team" = visible to all org members
    visibility: Mapped[str] = mapped_column(String(16), nullable=False, default="private")

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="documents")  # noqa: F821
    project: Mapped[Optional["Project"]] = relationship(  # noqa: F821
        "Project", back_populates="documents"
    )

    def __repr__(self) -> str:
        return f"<Document id={self.id} title={self.title[:40]}>"
