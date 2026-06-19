"""
0004_subscription_grace_period
Add grace_period_end and backup_sent columns to user_subscriptions.

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-19
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_subscriptions",
        sa.Column("grace_period_end", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "user_subscriptions",
        sa.Column("backup_sent", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("user_subscriptions", "backup_sent")
    op.drop_column("user_subscriptions", "grace_period_end")
