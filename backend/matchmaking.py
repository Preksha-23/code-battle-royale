import asyncio
import json
import uuid
import logging
from redis_client import get_redis
from socket_manager import manager
from puzzles import get_random_puzzle

logger = logging.getLogger("matchmaking")

# Redis List Key for the waiting queue
QUEUE_KEY = "cbr:queue"
# Redis Hash Key to store active rooms
ROOMS_KEY = "cbr:rooms"

async def pair_players_worker():
    """
    Infinite background task that scans the Redis queue.
    If 2 players are found, pops them, creates a room, and broadcasts via sockets.
    """
    local_redis = await get_redis()
    print("Matchmaking worker started...", flush=True)
    
    while True:
        try:
            # Check length of the queue
            queue_len = await local_redis.llen(QUEUE_KEY)
            if queue_len > 0:
                print(f"Queue length is: {queue_len}", flush=True)
            
            if queue_len >= 2:
                # Pop 2 oldest players from the queue (RPOP logic - FIFO)
                # Since we use RPOP, the oldest players are processed first
                player2_id = await local_redis.rpop(QUEUE_KEY)
                player1_id = await local_redis.rpop(QUEUE_KEY)
                
                if player1_id and player2_id:
                    room_uuid = str(uuid.uuid4())
                    puzzle = get_random_puzzle()
                    
                    room_data = {
                        "room_id": room_uuid,
                        "players": [player1_id, player2_id],
                        "status": "active",
                        "puzzle": puzzle
                    }
                    
                    await local_redis.hset(ROOMS_KEY, room_uuid, json.dumps(room_data))
                    
                    # Construct JSON payload
                    payload = {
                        "event": "match_found",
                        "data": room_data
                    }
                    
                    print(f"Match found! Broadcasting Room {room_uuid} with Puzzle '{puzzle['title']}' to {player1_id} and {player2_id}", flush=True)

                    # Broadcast the room information specifically to both matched clients via WS manager
                    try:
                        await manager.send_json(payload, player1_id)
                        await manager.send_json(payload, player2_id)
                    except Exception as loop_e:
                        print(f"Exception during broadcast: {loop_e}", flush=True)
                else:
                    # If we accidentally popped only 1 (race condition etc), put it back
                    if player1_id:
                        await local_redis.lpush(QUEUE_KEY, player1_id)
                    if player2_id:
                        await local_redis.lpush(QUEUE_KEY, player2_id)
            
            # Prevent aggressive busy-loop CPU spin; check every second
            await asyncio.sleep(1.0)
            
        except Exception as e:
            print(f"Error in matchmaking loop: {e}", flush=True)
            await asyncio.sleep(2.0)

async def join_queue(client_id: str):
    """Adds a client to the Redis Matchmaking queue."""
    redis = await get_redis()
    
    # Check if they're already in queue before pushing to avoid dupes
    current_queue = await redis.lrange(QUEUE_KEY, 0, -1)
    if client_id not in current_queue:
        # LPUSH inserts at head. So elements move to the right. RPOP drops the oldest element.
        await redis.lpush(QUEUE_KEY, client_id)
        logger.info(f"Added {client_id} to queue.")
        return True
    return False

async def leave_queue(client_id: str):
    """Removes a client from the Matchmaking queue."""
    redis = await get_redis()
    # Removes all occurrences
    await redis.lrem(QUEUE_KEY, 0, client_id)
    logger.info(f"Removed {client_id} from queue.")
