"""
One-time script: generates a ContextOS API key for the first user in the DB.
Run via: generate-key.bat
"""
import asyncio
import hashlib
import secrets
import uuid
from datetime import datetime, timezone

import psycopg
from dotenv import load_dotenv
import os

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

DB_URL = os.environ["DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://")


def main():
    raw_key = "ctxos_" + secrets.token_hex(32)
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_prefix = raw_key[:12]
    key_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            # Find first user
            cur.execute("SELECT id, email FROM users ORDER BY created_at ASC LIMIT 1")
            row = cur.fetchone()
            if not row:
                print("No users found. Sign in to the app first, then re-run this script.")
                return
            user_id, email = row
            print(f"Found user: {email} (id: {user_id})")

            # Insert API key
            cur.execute(
                """
                INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (key_id, user_id, "Claude Desktop", key_prefix, key_hash, now, now),
            )
        conn.commit()

    print()
    print("=" * 60)
    print("API KEY GENERATED — save this, it won't be shown again:")
    print()
    print(f"  {raw_key}")
    print()
    print("=" * 60)
    print()
    print("Writing to mcp-server/.env ...")

    env_path = os.path.join(os.path.dirname(__file__), "..", "mcp-server", ".env")
    with open(env_path, "w") as f:
        f.write(f"CONTEXTOS_API_URL=http://localhost:8000\n")
        f.write(f"CONTEXTOS_API_KEY={raw_key}\n")

    print(f"Done! mcp-server/.env written.")
    print()
    input("Press Enter to close...")


if __name__ == "__main__":
    main()
