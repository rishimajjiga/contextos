"""
0005_subscription_auto_renew_started_at
Add auto_renew and started_at columns to user_subscriptions.

auto_renew — tracks whether the subscription will auto-renew (default True).
             Set to False when user cancels with cancel_at_cycle_end=True.
started_at — when the subscription was first activated (first payment date).

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-25
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_subscriptions",
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "user_subscriptions",
        sa.Column("auto_renew", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("user_subscriptions", "auto_renew")
    op.drop_column("user_subscriptions", "started_at")
