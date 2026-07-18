"""
0007_subscription_new_member_offer
Add one-time "New Member Offer" tracking columns to user_subscriptions.

The first monthly Pro subscription per user gets a 3-month access period:
month 1 paid (₹499), months 2-3 free (Razorpay charges paused), recurring
billing resumes after the offer ends.

offer_used        — True once the user has EVER received the offer (never reset)
offer_applied     — True while the free months are in progress
offer_started_at  — first payment date (month 1)
offer_end_date    — end of the 3-month access period / next payment date
offer_free_months — free months granted (2)

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-18
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_subscriptions",
        sa.Column("offer_used", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "user_subscriptions",
        sa.Column("offer_applied", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "user_subscriptions",
        sa.Column("offer_started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "user_subscriptions",
        sa.Column("offer_end_date", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "user_subscriptions",
        sa.Column("offer_free_months", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("user_subscriptions", "offer_free_months")
    op.drop_column("user_subscriptions", "offer_end_date")
    op.drop_column("user_subscriptions", "offer_started_at")
    op.drop_column("user_subscriptions", "offer_applied")
    op.drop_column("user_subscriptions", "offer_used")
