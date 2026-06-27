from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os
from urllib.parse import urlparse

raw_url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://cbr_user:cbr_password@localhost:5432/cbr_db")
# Supabase/Railway inject "postgresql://", but SQLAlchemy async demands "postgresql+asyncpg://"
if raw_url.startswith("postgresql://"):
    raw_url = raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)

DATABASE_URL = raw_url

# Diagnostic log — prints the host/port so we can verify in Render logs (never logs the password)
try:
    _parsed = urlparse(raw_url.replace("postgresql+asyncpg://", "postgresql://"))
    print(f"[DB CONFIG] Host: {_parsed.hostname} | Port: {_parsed.port} | DB: {_parsed.path}")
except Exception:
    print("[DB CONFIG] Could not parse DATABASE_URL for diagnostics")

engine = create_async_engine(DATABASE_URL, echo=True)

# Create an async session factory
async_session = async_sessionmaker(engine, expire_on_commit=False)

# Create a declarative base for our models
Base = declarative_base()

async def get_db():
    """Dependency to yield a database session for requests"""
    async with async_session() as session:
        yield session
