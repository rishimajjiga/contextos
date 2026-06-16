"""initial schema

Creates all tables from scratch.
Run with: alembic upgrade head

Revision ID: 0001
Revises:
Create Date: 2026-06-14
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ────────────────────────────────────────────────────────────────
    # One row per Clerk user; provisioned automatically on first authenticated request.
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("clerk_id", sa.String(128), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("name", sa.String(255), nullable=False, server_default=""),
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
        sa.UniqueConstraint("clerk_id", name="uq_users_clerk_id"),
    )
    op.create_index("ix_users_clerk_id", "users", ["clerk_id"])
    op.create_index("ix_users_email", "users", ["email"])

    # ── profiles ─────────────────────────────────────────────────────────────
    # Layer 1 — Identity. One profile per user.
    op.create_table(
        "profiles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(255), nullable=False, server_default=""),
        sa.Column(
            "skills",
            ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "tone",
            sa.String(50),
            nullable=False,
            server_default="professional",
        ),
        sa.Column(
            "response_style",
            sa.String(50),
            nullable=False,
            server_default="technical",
        ),
        sa.Column(
            "programming_languages",
            ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "frameworks",
            ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
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
        sa.UniqueConstraint("user_id", name="uq_profiles_user_id"),
    )

    # ── projects ─────────────────────────────────────────────────────────────
    # Layer 2 — Projects. Each user can have many projects.
    op.create_table(
        "projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "stack",
            ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("goals", sa.Text(), nullable=False, server_default=""),
        sa.Column("architecture", sa.Text(), nullable=False, server_default=""),
        sa.Column("coding_style", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "active_tasks",
            ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "current_problems",
            ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
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
    op.create_index("ix_projects_user_id", "projects", ["user_id"])

    # ── documents ─────────────────────────────────────────────────────────────
    # Layer 3 — Knowledge. Notes, PDFs, code snippets, research.
    op.create_table(
        "documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            sa.String(36),
            sa.ForeignKey("projects.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "doc_type",
            sa.String(50),
            nullable=False,
            server_default="note",
        ),
        sa.Column("file_url", sa.String(1024), nullable=True),
        sa.Column(
            "tags",
            ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
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
    op.create_index("ix_documents_user_id", "documents", ["user_id"])
    op.create_index("ix_documents_project_id", "documents", ["project_id"])

    # ── api_keys ──────────────────────────────────────────────────────────────
    # Hashed keys for MCP / programmatic access.
    op.create_table(
        "api_keys",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("key_prefix", sa.String(12), nullable=False),
        sa.Column("key_hash", sa.String(64), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.UniqueConstraint("key_hash", name="uq_api_keys_key_hash"),
    )
    op.create_index("ix_api_keys_user_id", "api_keys", ["user_id"])

    # ── sessions ──────────────────────────────────────────────────────────────
    # Tracks which AI tools have connected and when they last accessed ContextOS.
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tool_name", sa.String(100), nullable=False),
        sa.Column(
            "last_used",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])


def downgrade() -> None:
    # Drop in reverse order of creation to respect foreign keys.
    op.drop_table("sessions")
    op.drop_table("api_keys")
    op.drop_table("documents")
    op.drop_table("projects")
    op.drop_table("profiles")
    op.drop_table("users")
