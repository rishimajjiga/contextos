"""
app/models/project.py
Layer 2 — Projects.  Each user can have many projects.
"""
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from .base import UUIDMixin, TimestampMixin
from .types import ArrayOfString


class Project(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "projects"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    stack: Mapped[list[str]] = mapped_column(ArrayOfString, nullable=False, default=list)
    goals: Mapped[str] = mapped_column(Text, nullable=False, default="")
    architecture: Mapped[str] = mapped_column(Text, nullable=False, default="")
    coding_style: Mapped[str] = mapped_column(Text, nullable=False, default="")
    active_tasks: Mapped[list[str]] = mapped_column(ArrayOfString, nullable=False, default=list)
    current_problems: Mapped[list[str]] = mapped_column(
        ArrayOfString, nullable=False, default=list
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="projects")  # noqa: F821
    documents: Mapped[list["Document"]] = relationship(  # noqa: F821
        "Document", back_populates="project", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Project id={self.id} name={self.name}>"
