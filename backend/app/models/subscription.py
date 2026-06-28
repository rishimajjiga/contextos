"""
app/models/subscription.py
One row per user — tracks their Stripe plan, subscription ID, and billing period.
"""
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from .base import UUIDMixin, TimestampMixin


class UserSubscription(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "user_subscriptions"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )

    # Plan: "free" | "pro" | "team" | "student" | "founder"
    plan: Mapped[str] = mapped_column(String(32), nullable=False, default="free")

    # Stripe IDs — null until the user subscribes
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    # "active" | "canceled" | "past_due" | "trialing" | "expired"
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")

    # When the current billing period ends (null for free forever)
    current_period_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Grace period: 30 days after subscription ends — data is read-only
    grace_period_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # True once the backup PDF has been emailed (prevents double-sends)
    backup_sent: Mapped[bool] = mapped_column(default=False, nullable=False)

    # When the subscription was first activated (set on first payment)
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Whether the subscription will auto-renew. Set to False when user cancels
    # with cancel_at_cycle_end=True (keeps access until period end, no renewal).
    auto_renew: Mapped[bool] = mapped_column(Boolean(), default=True, nullable=False)

    # True once the user has ever activated the one-time free Student trial.
    # Stays True forever (even after the trial expires and the plan reverts to
    # free) so the 30-day trial can never be re-claimed for unlimited free access.
    trial_used: Mapped[bool] = mapped_column(Boolean(), default=False, nullable=False)

    # Relationship back to User
    user: Mapped["User"] = relationship("User", back_populates="subscription")  # noqa: F821

    def __repr__(self) -> str:
        return f"<UserSubscription user={self.user_id} plan={self.plan} status={self.status}>"
