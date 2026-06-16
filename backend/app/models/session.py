"""
app/models/session.py
Tracks which AI tools have connected and when they last accessed ContextOS.
"""
from sqlalchemy import ForeignKey, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone

from app.database import Base
from .base import UUIDMixin


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AISession(Base, UUIDMixin):
    __tablename__ = "sessions"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tool_name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # e.g. "chatgpt", "claude", "cursor"
    last_used: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sessions")  # noqa: F821

    def __repr__(self) -> str:
        return f"<AISession user={self.user_id} tool={self.tool_name}>"
