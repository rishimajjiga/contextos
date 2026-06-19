"""thread_events table

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-18
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "thread_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "project_id",
            sa.String(36),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("event_type", sa.String(64), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("detail", sa.Text, nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_thread_events_project_id", "thread_events", ["project_id"])
    op.create_index("ix_thread_events_user_id", "thread_events", ["user_id"])
    op.create_index(
        "ix_thread_events_project_created",
        "thread_events",
        ["project_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_thread_events_project_created", table_name="thread_events")
    op.drop_index("ix_thread_events_user_id", table_name="thread_events")
    op.drop_index("ix_thread_events_project_id", table_name="thread_events")
    op.drop_table("thread_events")
