"""
Migration script: Add client_id and password_hash columns to the users table,
and create the friendships table if it doesn't exist.
Run: python migrate.py
"""
import asyncio
from sqlalchemy import text
from database import engine, Base
from models import User, Friendship


async def migrate():
    async with engine.begin() as conn:
        print("Running migrations...")

        # 1. Add client_id column to users (uses gen_random_uuid from pgcrypto)
        try:
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS client_id VARCHAR(36) UNIQUE"
            ))
            print("  [OK] client_id column ensured")
        except Exception as e:
            print(f"  [WARN] client_id: {e}")

        # 2. Populate client_id for existing rows that have NULL
        try:
            await conn.execute(text(
                "UPDATE users SET client_id = gen_random_uuid()::VARCHAR WHERE client_id IS NULL"
            ))
            print("  [OK] Populated client_id for existing rows")
        except Exception as e:
            print(f"  [WARN] populate client_id: {e}")

        # 3. Add password_hash column to users
        try:
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(256) NOT NULL DEFAULT ''"
            ))
            print("  [OK] password_hash column ensured")
        except Exception as e:
            print(f"  [WARN] password_hash: {e}")

        # 4. Add winstreak column to users
        try:
            await conn.execute(text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS winstreak INTEGER NOT NULL DEFAULT 0"
            ))
            print("  [OK] winstreak column ensured")
        except Exception as e:
            print(f"  [WARN] winstreak: {e}")

        # 5. Create friendships table if it doesn't exist
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS friendships (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    is_sender BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """))
            print("  [OK] friendships table ensured")
        except Exception as e:
            print(f"  [WARN] friendships: {e}")

        print("Migration complete!")


if __name__ == "__main__":
    asyncio.run(migrate())
