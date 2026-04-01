import redis.asyncio as redis
import os

# Connection matching our docker-compose configuration
# Note: Railway automatically injects REDIS_URL/REDIS_PRIVATE_URL
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Create a global redis connection pool for reuse
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

async def get_redis():
    """Dependency to yield the Redis client"""
    return redis_client
