"""
app/models/payment.py

Records every individual Razorpay payment transaction.
One row per payment attempt — distinct from UserSubscription, which tracks
the ongoing subscription state.

Fields mirror the Razorpay payment object:
  payment_id   — Razorpay payment ID  (pay_XXXX)
  order_id     — Razorpay order ID    (order_XXXX) — null for subscription charges
  subscription_id — Razorpay subscription ID (sub_XXXX)
  amount       — Amount in smallest currency unit (paise for INR)
  currency     — ISO 4217 currency code (e.g. "INR")
  status       — "captured" | "failed" | "refunded" | "pending"
  plan_name    — The plan the user purchased ("pro" | "team" | "student")
  purchase_date — When the payment was captured (UTC)
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from .base import UUIDMixin, TimestampMixin


class Payment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "payments"

    # The user who made the payment (Clerk user ID)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # Razorpay identifiers
    payment_id: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    order_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    subscription_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)

    # Payment details
    amount: Mapped[int] = mapped_column(Integer, nullable=False)          # in paise (INR × 100)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="INR")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="captured")
    plan_name: Mapped[str] = mapped_column(String(32), nullable=False, default="pro")

    # When Razorpay captured the payment (may differ from created_at by seconds)
    purchase_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
    )

    # Relationship back to User
    user: Mapped["User"] = relationship("User")  # noqa: F821

    def __repr__(self) -> str:
        return (
            f"<Payment user={self.user_id} plan={self.plan_name} "
            f"amount={self.amount} status={self.status}>"
        )
