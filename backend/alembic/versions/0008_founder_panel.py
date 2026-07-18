"""
0008_founder_panel
Founder Panel tables: activity log, manual grants, notifications (+ reads),
announcement banners, support tickets. Keyed to the existing FOUNDER_EMAILS
config — no new role/login.

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-18
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "founder_activity_log",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("actor_user_id", sa.String(36), nullable=False),
        sa.Column("actor_email", sa.String(255), nullable=False, server_default=""),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("target_user_id", sa.String(36), nullable=True),
        sa.Column("target_email", sa.String(255), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False, server_default=""),
        sa.Column("details", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_founder_activity_log_actor_user_id", "founder_activity_log", ["actor_user_id"])
    op.create_index("ix_founder_activity_log_target_user_id", "founder_activity_log", ["target_user_id"])

    op.create_table(
        "manual_grants",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan", sa.String(32), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reason", sa.Text(), nullable=False, server_default=""),
        sa.Column("category", sa.String(64), nullable=True),
        sa.Column("granted_by", sa.String(36), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("prev_plan", sa.String(32), nullable=True),
        sa.Column("prev_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("removed_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_manual_grants_user_id", "manual_grants", ["user_id"])

    op.create_table(
        "notifications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False, server_default=""),
        sa.Column("type", sa.String(32), nullable=False, server_default="announcement"),
        sa.Column("audience", sa.String(32), nullable=False, server_default="everyone"),
        sa.Column("target_user_ids", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("status", sa.String(16), nullable=False, server_default="sent"),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "notification_reads",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("notification_id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_notification_reads_notification_id", "notification_reads", ["notification_id"])
    op.create_index("ix_notification_reads_user_id", "notification_reads", ["user_id"])

    op.create_table(
        "announcement_banners",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False, server_default=""),
        sa.Column("button_text", sa.String(64), nullable=True),
        sa.Column("button_url", sa.String(512), nullable=True),
        sa.Column("audience", sa.String(32), nullable=False, server_default="everyone"),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "support_tickets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False, server_default=""),
        sa.Column("message", sa.Text(), nullable=False, server_default=""),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_support_tickets_user_id", "support_tickets", ["user_id"])


def downgrade() -> None:
    op.drop_table("support_tickets")
    op.drop_table("announcement_banners")
    op.drop_index("ix_notification_reads_user_id", table_name="notification_reads")
    op.drop_index("ix_notification_reads_notification_id", table_name="notification_reads")
    op.drop_table("notification_reads")
    op.drop_table("notifications")
    op.drop_index("ix_manual_grants_user_id", table_name="manual_grants")
    op.drop_table("manual_grants")
    op.drop_index("ix_founder_activity_log_target_user_id", table_name="founder_activity_log")
    op.drop_index("ix_founder_activity_log_actor_user_id", table_name="founder_activity_log")
    op.drop_table("founder_activity_log")
