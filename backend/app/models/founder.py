"""
app/models/founder.py
Founder Panel tables — admin capabilities keyed to the existing FOUNDER_EMAILS
config (no separate admin role/login). All rows are created only by verified
founder accounts; see app/services/founder_service.py and endpoints/founder.py.

Portable across Postgres (prod) and SQLite (tests): JSON-ish fields are stored
as TEXT holding a JSON string, so no dialect-specific JSON type is needed.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from .base import UUIDMixin, TimestampMixin


class FounderActivityLog(Base, UUIDMixin, TimestampMixin):
    """Immutable record of every founder action (audit trail)."""
    __tablename__ = "founder_activity_log"

    actor_user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    actor_email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    action: Mapped[str] = mapped_column(String(64), nullable=False)          # grant_plan, change_plan, remove_grant, send_notification, ...
    target_user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)
    target_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    details: Mapped[str] = mapped_column(Text, nullable=False, default="{}")  # JSON string (before/after, plan, duration…)


class ManualGrant(Base, UUIDMixin, TimestampMixin):
    """A plan/access grant a founder made by hand (compensation, comp, etc.).
    Keeps the pre-grant state so a grant can be cleanly reverted."""
    __tablename__ = "manual_grants"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    plan: Mapped[str] = mapped_column(String(32), nullable=False)             # free|student|pro|team
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[Optional[str]] = mapped_column(String(64), nullable=True) # compensation reason bucket
    granted_by: Mapped[str] = mapped_column(String(36), nullable=False)       # founder user_id
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Pre-grant snapshot for a clean revert
    prev_plan: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    prev_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    removed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    removed_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Notification(Base, UUIDMixin, TimestampMixin):
    """In-app notification broadcast to an audience or selected users."""
    __tablename__ = "notifications"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    type: Mapped[str] = mapped_column(String(32), nullable=False, default="announcement")  # update|announcement|feature|maintenance|warning
    audience: Mapped[str] = mapped_column(String(32), nullable=False, default="everyone")   # everyone|free|student|pro|team|selected
    target_user_ids: Mapped[str] = mapped_column(Text, nullable=False, default="[]")        # JSON list (audience=selected)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="sent")          # sent|scheduled|draft
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[str] = mapped_column(String(36), nullable=False)


class NotificationRead(Base, UUIDMixin, TimestampMixin):
    """Per-user read receipt for a notification."""
    __tablename__ = "notification_reads"

    notification_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)


class AnnouncementBanner(Base, UUIDMixin, TimestampMixin):
    """Website banner shown to an audience within a date window."""
    __tablename__ = "announcement_banners"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    button_text: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    button_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    audience: Mapped[str] = mapped_column(String(32), nullable=False, default="everyone")
    start_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[str] = mapped_column(String(36), nullable=False)


class SupportTicket(Base, UUIDMixin, TimestampMixin):
    """User-submitted support request, triaged in the Founder Panel."""
    __tablename__ = "support_tickets"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="open")  # open|in_progress|resolved
    resolution_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
