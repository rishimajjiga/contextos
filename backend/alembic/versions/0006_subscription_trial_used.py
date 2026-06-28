"""
0006_subscription_trial_used
Add trial_used column to user_subscriptions.

trial_used — True once the user has ever activated the one-time free Student
             trial. Prevents re-claiming the 30-day trial after it expires
             (which previously allowed unlimited free trials by re-calling
             POST /billing/student-claim once the plan reverted to free).

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-28
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_subscriptions",
        sa.Column(
            "trial_used",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
    # Backfill: anyone currently on (or who has ever held) a student trial has
    # already consumed it. Mark existing student rows so they can't re-claim.
    op.execute(
        "UPDATE user_subscriptions SET trial_used = true "
        "WHERE plan = 'student' OR status = 'trialing'"
    )


def downgrade() -> None:
    op.drop_column("user_subscriptions", "trial_used")
