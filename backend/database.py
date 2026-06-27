from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode

raw_url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://cbr_user:cbr_password@localhost:5432/cbr_db")

# Supabase/Railway inject "postgresql://", but SQLAlchemy async demands "postgresql+asyncpg://"
if raw_url.startswith("postgresql://"):
    raw_url = raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Strip unsupported query params that Supabase adds (e.g. pgbouncer=true)
# asyncpg does not understand these and will throw: unexpected keyword argument 'pgbouncer'
try:
    _p = urlparse(raw_url)
    _params = parse_qs(_p.query)
    _params.pop("pgbouncer", None)   # remove pgbouncer param if present
    _params.pop("sslmode", None)     # asyncpg handles SSL via connect_args, not URL
    _clean_query = urlencode({k: v[0] for k, v in _params.items()})
    raw_url = urlunparse(_p._replace(query=_clean_query))
except Exception as e:
    print(f"[DB CONFIG] Warning: could not strip URL params: {e}")

DATABASE_URL = raw_url

# Diagnostic log — prints the host/port (never the password)
try:
    _parsed = urlparse(raw_url.replace("postgresql+asyncpg://", "postgresql://"))
    print(f"[DB CONFIG] Host: {_parsed.hostname} | Port: {_parsed.port} | DB: {_parsed.path}")
except Exception:
    print("[DB CONFIG] Could not parse DATABASE_URL for diagnostics")

# prepared_statement_cache_size=0 is required when connecting through PgBouncer (Supabase pooler)
engine = create_async_engine(
    DATABASE_URL,
    echo=True,
    connect_args={"prepared_statement_cache_size": 0}
)

# Create an async session factory
async_session = async_sessionmaker(engine, expire_on_commit=False)

# Create a declarative base for our models
Base = declarative_base()

async def get_db():
    """Dependency to yield a database session for requests"""
    async with async_session() as session:
        yield session
