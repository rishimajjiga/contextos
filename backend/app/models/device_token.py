"""
app/models/device_token.py
Per-device FCM registration tokens — one row per (user, device) pair.

Tokens are upserted on sign-in / token refresh and soft-deactivated on
sign-out so we never send to a stale registration.  If FCM reports a token
as UNREGISTERED the push service marks it inactive automatically.
"""
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from .base import UUIDMixin, TimestampMixin


class DeviceToken(Base, UUIDMixin, TimestampMixin):
    """FCM registration token stored per-device for targeted push delivery."""
    __tablename__ = "device_tokens"
    __table_args__ = (
        UniqueConstraint("token", name="uq_device_tokens_token"),
    )

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        index=True, nullable=False,
    )
    token: Mapped[str] = mapped_column(String(512), nullable=False)
    platform: Mapped[str] = mapped_column(
        String(16), nullable=False, default="android",
    )  # android | ios | web
    device_name: Mapped[Optional[str]] = mapped_column(
        String(128), nullable=True,
    )
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    def __repr__(self) -> str:
        return f"<DeviceToken user={self.user_id} platform={self.platform} active={self.active}>"
