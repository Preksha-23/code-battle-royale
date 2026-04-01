import asyncio
import redis.asyncio as redis

async def main():
    r = redis.from_url("redis://localhost:6379/0", decode_responses=True)
    await r.lpush("test_q", "hello")
    res = await r.rpop("test_q")
    print(f"RPOP result: {res}")
    
asyncio.run(main())
