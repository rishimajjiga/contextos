"""
0009_device_tokens
Per-device FCM registration tokens for targeted push notifications.
One row per registration token; unique on the token itself so the same
device re-registering just upserts. Soft-deactivated (active=False) on
sign-out or when FCM reports the token UNREGISTERED.

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-23
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "device_tokens",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id", sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("token", sa.String(512), nullable=False),
        sa.Column("platform", sa.String(16), nullable=False, server_default="android"),
        sa.Column("device_name", sa.String(128), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_device_tokens_user_id", "device_tokens", ["user_id"])
    op.create_unique_constraint("uq_device_tokens_token", "device_tokens", ["token"])


def downgrade() -> None:
    op.drop_constraint("uq_device_tokens_token", "device_tokens", type_="unique")
    op.drop_index("ix_device_tokens_user_id", table_name="device_tokens")
    op.drop_table("device_tokens")
