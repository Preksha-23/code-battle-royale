import asyncio
import random
import re
import json
from socket_manager import manager
from redis_client import get_redis

BOT_CLIENT_ID = "cyber_bot_3000"

def obscure_code(code: str) -> str:
    # Replaces all non-whitespace/non-newline characters with block characters 
    return re.sub(r'[^\s\n]', '█', code)

async def simulate_practice_bot(room_id: str):
    """
    Simulates a live practice bot in a room.
    Types out code gradually (obscured) and then wins if the player hasn't submitted yet.
    """
    print(f"Bot simulation started for room {room_id}", flush=True)
    
    # Give a short delay for player to connect
    await asyncio.sleep(2.0)
    
    redis_client = await get_redis()
    room_str = await redis_client.hget("cbr:rooms", room_id)
    if not room_str:
        print(f"Room {room_id} not found in Redis on bot startup. Exiting bot.", flush=True)
        return
        
    room_data = json.loads(room_str)
    puzzle = room_data.get("puzzle", {})
    puzzle_id = puzzle.get("id")
    
    from puzzles import PUZZLES
    solution_code = next((p["solution"] for p in PUZZLES if p["id"] == puzzle_id), "# Let me think...")
    
    # Broadcast "player_joined" for the bot to make it appear on frontend
    await manager.broadcast_to_room(
        room_id, 
        {"event": "player_joined", "data": {"client_id": BOT_CLIENT_ID}}
    )
    
    # Simulate reading/thinking time
    thinking_time = random.uniform(3.0, 6.0)
    await asyncio.sleep(thinking_time)
    
    # Simulate typing the solution
    full_text = solution_code
    total_len = len(full_text)
    current_idx = 0
    
    # Determine bot speed (Medium difficulty: ~60 to 90 seconds to solve)
    total_typing_time = random.uniform(60.0, 90.0)
    step_delay = 0.4
    
    num_steps = int(total_typing_time / step_delay)
    chars_per_step = max(1, int(total_len / num_steps))
    
    while current_idx < total_len:
        # Check if the room is still active
        room_str = await redis_client.hget("cbr:rooms", room_id)
        if not room_str:
            print(f"Room {room_id} closed. Stopping bot.", flush=True)
            return
            
        room_data = json.loads(room_str)
        if room_data.get("status") != "active":
            print(f"Room {room_id} status is {room_data.get('status')}. Stopping bot.", flush=True)
            return
            
        # Natural typing variation: occasionally pause, type faster/slower
        if random.random() < 0.15:
            # Short thinking pause
            increment = 0
        else:
            increment = int(chars_per_step * random.uniform(0.5, 2.0))
            
        current_idx = min(total_len, current_idx + increment)
        typed_code = full_text[:current_idx]
        
        # Broadcast the obscured code to the room
        obscured = obscure_code(typed_code)
        
        payload = {
            "event": "editor_update",
            "data": {
                "code": obscured
            }
        }
        await manager.broadcast_to_room(room_id, payload)
        
        await asyncio.sleep(step_delay + random.uniform(-0.1, 0.1))
        
    # Typing complete. Wait a moment, then "submit" and win.
    await asyncio.sleep(random.uniform(1.5, 3.0))
    
    # Check again if room is still active
    room_str = await redis_client.hget("cbr:rooms", room_id)
    if room_str:
        room_data = json.loads(room_str)
        if room_data.get("status") == "active":
            room_data["status"] = "finished"
            room_data["winner"] = BOT_CLIENT_ID
            await redis_client.hset("cbr:rooms", room_id, json.dumps(room_data))
            
            win_payload = {
                "event": "game_over",
                "data": {"winner": BOT_CLIENT_ID}
            }
            await manager.broadcast_to_room(room_id, win_payload)
            print(f"Bot won room {room_id} by submission!", flush=True)
            
            # Persist player loss stats to DB
            try:
                from main import db_update_game_result
                asyncio.create_task(db_update_game_result(room_data, BOT_CLIENT_ID))
            except Exception as e:
                print(f"Failed to trigger db update for bot victory: {e}", flush=True)
