"""
app/models/api_key.py
API keys for MCP server / programmatic access (alternative to Clerk JWT).
"""
from typing import Optional
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from .base import UUIDMixin, TimestampMixin


class ApiKey(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "api_keys"

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)          # human label
    key_prefix: Mapped[str] = mapped_column(String(12), nullable=False)     # first 8 chars for display
    key_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)  # sha256 hex
    last_used_at: Mapped[Optional[str]] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<ApiKey id={self.id} name={self.name} prefix={self.key_prefix}>"
