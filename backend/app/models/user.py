"""
app/models/user.py
Users table — one row per Clerk user (synced on first authenticated request).
"""
from sqlalchemy import Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from .base import UUIDMixin, TimestampMixin


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("clerk_id", name="uq_users_clerk_id"),
        # Founder dashboard sorts user lists by signup date and counts
        # today's signups — keep those scans off a full table walk.
        Index("ix_users_created_at", "created_at"),
    )

    clerk_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    # Relationships
    profile: Mapped["Profile"] = relationship(  # noqa: F821
        "Profile", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    projects: Mapped[list["Project"]] = relationship(  # noqa: F821
        "Project", back_populates="user", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["AISession"]] = relationship(  # noqa: F821
        "AISession", back_populates="user", cascade="all, delete-orphan"
    )
    subscription: Mapped["UserSubscription"] = relationship(  # noqa: F821
        "UserSubscription", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    org_memberships: Mapped[list["OrganizationMember"]] = relationship(  # noqa: F821
        "OrganizationMember", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"
