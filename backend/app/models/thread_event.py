"""
app/models/thread_event.py
Append-only log of meaningful events inside a project.
Used to power the "Context Thread" timeline on the project detail page.
"""
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from .base import UUIDMixin, TimestampMixin

# Allowed event types — keep this narrow and explicit.
# "project_created"   — project was first created
# "document_added"    — text/note document saved to project
# "file_uploaded"     — file (PDF, etc.) uploaded to project
# "project_updated"   — project metadata edited
EVENT_TYPES = (
    "project_created",
    "document_added",
    "file_uploaded",
    "project_updated",
)


class ThreadEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "thread_events"

    project_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # One of EVENT_TYPES
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    # Short human-readable summary — shown in the timeline
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # Optional extra detail (doc content preview, file name, etc.)
    detail: Mapped[str] = mapped_column(Text, nullable=False, default="")

    def __repr__(self) -> str:
        return f"<ThreadEvent id={self.id} type={self.event_type} project={self.project_id}>"
