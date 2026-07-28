"""
0010_founder_user_list_indexes
Indexes backing the founder dashboard's clickable user lists: category
drill-downs filter user_subscriptions by plan/status and sort users by
signup date, so those columns must not force full-table scans as the
user base grows into the thousands.

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-24
"""
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_user_subscriptions_plan", "user_subscriptions", ["plan"])
    op.create_index("ix_user_subscriptions_status", "user_subscriptions", ["status"])
    op.create_index("ix_users_created_at", "users", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_users_created_at", table_name="users")
    op.drop_index("ix_user_subscriptions_status", table_name="user_subscriptions")
    op.drop_index("ix_user_subscriptions_plan", table_name="user_subscriptions")
