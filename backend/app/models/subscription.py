"""
app/models/subscription.py
One row per user — tracks their Stripe plan, subscription ID, and billing period.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from .base import UUIDMixin, TimestampMixin


class UserSubscription(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "user_subscriptions"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )

    # Plan: "free" | "pro" | "team"
    plan: Mapped[str] = mapped_column(String(32), nullable=False, default="free")

    # Stripe IDs — null until the user subscribes
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # "active" | "canceled" | "past_due" | "trialing"
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    # When the current billing period ends (null for free forever)
    current_period_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Grace period: 30 days after subscription ends — data is read-only
    grace_period_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # True once the backup PDF has been emailed (prevents 