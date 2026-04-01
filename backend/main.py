import asyncio
import json
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from database import engine, get_db, Base
from redis_client import get_redis
from socket_manager import manager
from matchmaking import join_queue, leave_queue, pair_players_worker

app = FastAPI(title="Code Battle Royale API", version="1.0.0")

# Configure CORS for our frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the Vite frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prevent GC of background tasks
background_tasks = set()

@app.on_event("startup")
async def startup_event():
    # Attempt to create tables on startup (in a real app you might use Alembic)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # Start matchmaking worker loop
    task = asyncio.create_task(pair_players_worker())
    background_tasks.add(task)

@app.get("/health")
async def health_check(
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """
    Health check endpoint that verifies connectivity to Postgres and Redis.
    """
    health_status = {
        "status": "up",
        "postgres": "down",
        "redis": "down"
    }
    
    # Check Postgres
    try:
        await db.execute(text("SELECT 1"))
        health_status["postgres"] = "up"
    except Exception as e:
        print(f"Postgres health check failed: {e}")
        
    # Check Redis
    try:
        await redis_client.ping()
        health_status["redis"] = "up"
    except Exception as e:
        print(f"Redis health check failed: {e}")
        
    if health_status["postgres"] != "up" or health_status["redis"] != "up":
        # If any essential service is down, the API is degraded
        health_status["status"] = "degraded"
        
    return health_status

@app.get("/")
async def root():
    return {"message": "Welcome to the Code Battle Royale API"}

@app.websocket("/ws/matchmaking/{client_id}")
async def websocket_matchmaking(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    try:
        # Client joined. Add to Redis queue
        await join_queue(client_id)
        # Send acknowledged payload
        await manager.send_json({"event": "queued", "data": {"status": "searching"}}, client_id)
        
        while True:
            # Keep connection open. Read UI actions like cancellation.
            data = await websocket.receive_text()
            if data == "cancel":
                await leave_queue(client_id)
                await manager.send_json({"event": "cancelled", "data": {}}, client_id)
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        await leave_queue(client_id)

@app.websocket("/ws/arena/{room_id}/{client_id}")
async def websocket_arena(websocket: WebSocket, room_id: str, client_id: str):
    await manager.connect(websocket, client_id)
    manager.join_room(room_id, client_id)
    try:
        # Notify room that player connected (optional)
        await manager.broadcast_to_room(
            room_id, 
            {"event": "player_joined", "data": {"client_id": client_id}},
            exclude_client=client_id
        )

        while True:
            # Receive text data (expecting JSON structure)
            data_str = await websocket.receive_text()
            try:
                data = json.loads(data_str)
                event_type = data.get("event")
                
                if event_type == "editor_update":
                    # Broadcast this action directly back to the rest of the room
                    await manager.broadcast_to_room(room_id, data, exclude_client=client_id)
                
                elif event_type == "submit_code":
                    # Code execution phase
                    submitted_code = data.get("data", {}).get("code", "")
                    
                    # We need the puzzle data. Since we store the state in Redis `cbr:rooms`, we can pull it!
                    redis_client = await get_redis()
                    room_str = await redis_client.hget("cbr:rooms", room_id)
                    
                    if room_str:
                        from evaluator import evaluate_code
                        room_data = json.loads(room_str)
                        test_cases = room_data.get("puzzle", {}).get("test_cases", [])
                        
                        # Use to_thread to prevent blocking the asyncio event loop during execution
                        eval_result = await asyncio.to_thread(evaluate_code, submitted_code, test_cases)
                        
                        if eval_result["success"]:
                            # They passed all tests! They win!
                            win_payload = {
                                "event": "game_over",
                                "data": {"winner": client_id}
                            }
                            await manager.broadcast_to_room(room_id, win_payload)
                        else:
                            # They failed. Send them an error message personally.
                            error_payload = {
                                "event": "test_failed",
                                "data": eval_result
                            }
                            await manager.send_json(error_payload, client_id)

            except json.JSONDecodeError:
                pass
                
    except WebSocketDisconnect:
        manager.leave_room(room_id, client_id)
        manager.disconnect(client_id)
        # Notify opponent of disconnection
        await manager.broadcast_to_room(
            room_id,
            {"event": "player_left", "data": {"client_id": client_id}}
        )

from pydantic import BaseModel
import uuid
from puzzles import get_random_puzzle

class PracticeRequest(BaseModel):
    client_id: str

@app.post("/api/practice")
async def start_practice(req: PracticeRequest, redis_client: redis.Redis = Depends(get_redis)):
    """
    Creates a single-player room for practicing algorithmic puzzles.
    """
    room_uuid = str(uuid.uuid4())
    puzzle = get_random_puzzle()
    
    room_data = {
        "room_id": room_uuid,
        "players": [req.client_id],
        "status": "active",
        "puzzle": puzzle
    }
    
    # Store directly in our active rooms
    await redis_client.hset("cbr:rooms", room_uuid, json.dumps(room_data))
    
    return {"status": "success", "room_data": room_data}
