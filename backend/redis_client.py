import redis.asyncio as redis
import os

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Validate the URL scheme — Upstash REST URLs (https://) are NOT valid Redis URLs.
# The TCP URL from Upstash starts with rediss:// — make sure that's what's set.
VALID_SCHEMES = ("redis://", "rediss://", "unix://")
if not any(REDIS_URL.startswith(scheme) for scheme in VALID_SCHEMES):
    raise ValueError(
        f"Invalid REDIS_URL scheme: '{REDIS_URL[:30]}...'\n"
        "Expected a URL starting with redis://, rediss://, or unix://\n"
        "Tip: In Upstash, go to Connect → TCP tab to get the correct rediss:// URL."
    )

# Create a global redis connection pool for reuse
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

async def get_redis():
    """Dependency to yield the Redis client"""
    return redis_client
