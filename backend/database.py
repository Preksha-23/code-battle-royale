from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os

# Define the connection string matching our docker-compose config
DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+asyncpg://cbr_user:cbr_password@localhost:5432/cbr_db")

# Create the async engine
engine = create_async_engine(DATABASE_URL, echo=True)

# Create an async session factory
async_session = async_sessionmaker(engine, expire_on_commit=False)

# Create a declarative base for our models
Base = declarative_base()

async def get_db():
    """Dependency to yield a database session for requests"""
    async with async_session() as session:
        yield session
