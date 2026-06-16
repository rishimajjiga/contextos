"""
app/models/types.py
Custom SQLAlchemy types for cross-database compatibility.
- PostgreSQL (production): uses native ARRAY
- SQLite (testing): stores as JSON text
"""
import json
from sqlalchemy import ARRAY, JSON, String, TypeDecorator
from sqlalchemy.engine import Dialect


class ArrayOfString(TypeDecorator):
    """
    A list-of-strings column that works on both PostgreSQL (ARRAY) and
    SQLite (JSON-encoded text).  Use this instead of ARRAY(String) so that
    the test suite can run against an in-memory SQLite database.
    """

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect: Dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(ARRAY(String))
        return dialect.type_descriptor(JSON())

    def process_bind_param(self, value, dialect: Dialect):
        if dialect.name == "postgresql":
            return value  # PostgreSQL handles native lists
        if value is None:
            return "[]"
        return json.dumps(value)

    def process_result_value(self, value, dialect: Dialect):
        if dialect.name == "postgresql":
            return value if value is not None else []
        if value is None:
            return []
        if isinstance(value, list):
            return value
        try:
            return json.loads(value)
        except (TypeError, ValueError):
            return []
