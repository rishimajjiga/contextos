"""
app/models/profile.py
Layer 1 — Identity.  One profile per user.
"""
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from .base import UUIDMixin, TimestampMixin
from .types import ArrayOfString


class Profile(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "profiles"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )

    role: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    skills: Mapped[list] = mapped_column(ArrayOfString, nullable=False, default=list)
    tone: Mapped[str] = mapped_column(
        String(50), nullable=False, default="professional"
    )  # professional | casual | concise | detailed
    response_style: Mapped[str] = mapped_column(
        String(50), nullable=False, default="technical"
    )  # technical | conversational | bullet-points | narrative
    programming_languages: Mapped[list] = mapped_column(
        ArrayOfString, nullable=False, default=list
    )
    frameworks: Mapped[list] = mapped_column(ArrayOfString, nullable=False, default=list)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="profile")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Profile user_id={self.user_id} role={self.role}>"
