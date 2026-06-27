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

import time

async def pair_players_worker():
    """
    Infinite background task that scans the Redis queues.
    If 2 players are found in the same difficulty queue, pops them, creates a room, and broadcasts via sockets.
    """
    local_redis = await get_redis()
    print("Matchmaking worker started...", flush=True)
    
    while True:
        try:
            for difficulty in ["easy", "intermediate", "difficult"]:
                queue_key = f"cbr:queue:{difficulty}"
                queue_len = await local_redis.llen(queue_key)
                
                if queue_len >= 2:
                    # Pop 2 oldest players from the queue (RPOP logic - FIFO)
                    player2_id = await local_redis.rpop(queue_key)
                    player1_id = await local_redis.rpop(queue_key)
                    
                    if player1_id and player2_id:
                        p1 = player1_id.decode('utf-8') if isinstance(player1_id, bytes) else player1_id
                        p2 = player2_id.decode('utf-8') if isinstance(player2_id, bytes) else player2_id
                        
                        room_uuid = str(uuid.uuid4())
                        from puzzles import get_puzzle_for_players
                        puzzle = await get_puzzle_for_players([p1, p2], local_redis, difficulty)
                        
                        # Strip the solution before sending to the client
                        frontend_puzzle = {k: v for k, v in puzzle.items() if k != "solution"}
                        
                        room_data = {
                            "room_id": room_uuid,
                            "players": [p1, p2],
                            "status": "active",
                            "puzzle": frontend_puzzle,
                            "created_at": time.time(),
                            "difficulty": difficulty
                        }
                        
                        await local_redis.hset(ROOMS_KEY, room_uuid, json.dumps(room_data))
                        
                        # Construct JSON payload
                        payload = {
                            "event": "match_found",
                            "data": room_data
                        }
                        
                        print(f"Match found! Broadcasting Room {room_uuid} with Puzzle '{frontend_puzzle['title']}' to {p1} and {p2}", flush=True)
    
                        # Broadcast the room information specifically to both matched clients via WS manager
                        try:
                            await manager.send_json(payload, p1)
                            await manager.send_json(payload, p2)
                        except Exception as loop_e:
                            print(f"Exception during broadcast: {loop_e}", flush=True)
                    else:
                        # If we accidentally popped only 1 (race condition etc), put it back
                        if player1_id:
                            await local_redis.lpush(queue_key, player1_id)
                        if player2_id:
                            await local_redis.lpush(queue_key, player2_id)
            
            # Prevent aggressive busy-loop CPU spin; check every second
            await asyncio.sleep(1.0)
            
        except Exception as e:
            print(f"Error in matchmaking loop: {e}", flush=True)
            await asyncio.sleep(2.0)

async def join_queue(client_id: str, difficulty: str):
    """Adds a client to the Redis Matchmaking queue for a specific difficulty."""
    redis = await get_redis()
    
    # Remove from any other difficulty queue first to avoid duplication
    for diff in ["easy", "intermediate", "difficult"]:
        other_key = f"cbr:queue:{diff}"
        await redis.lrem(other_key, 0, client_id)
        
    queue_key = f"cbr:queue:{difficulty}"
    # LPUSH inserts at head. So elements move to the right. RPOP drops the oldest element.
    await redis.lpush(queue_key, client_id)
    logger.info(f"Added {client_id} to queue {difficulty}.")
    return True

async def leave_queue(client_id: str):
    """Removes a client from all matchmaking queues."""
    redis = await get_redis()
    for diff in ["easy", "intermediate", "difficult"]:
        queue_key = f"cbr:queue:{diff}"
        await redis.lrem(queue_key, 0, client_id)
    logger.info(f"Removed {client_id} from all matchmaking queues.")

