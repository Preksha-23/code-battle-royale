import asyncio
import json
import time
import os
import hashlib
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, desc, and_, or_

# Password hashing utilities
def hash_password(password: str) -> str:
    """Hash a password with a random salt using PBKDF2-HMAC-SHA256."""
    salt = os.urandom(16)
    pwdhash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100_000)
    return f"{salt.hex()}:{pwdhash.hex()}"

def verify_password(stored_password: str, provided_password: str) -> bool:
    """Verify a provided password against the stored hash."""
    try:
        salt_hex, hash_hex = stored_password.split(':')
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    pwdhash = hashlib.pbkdf2_hmac('sha256', provided_password.encode('utf-8'), salt, 100_000)
    return pwdhash.hex() == hash_hex

from database import engine, get_db, Base
from redis_client import get_redis
from socket_manager import manager
from matchmaking import join_queue, leave_queue, pair_players_worker
from models import User, Friendship
from evaluator import evaluate_code

app = FastAPI(title="Code Battle Royale API", version="1.0.0")

# Configure CORS for our frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prevent GC of background tasks
background_tasks = set()

@app.on_event("startup")
async def startup_event():
    # Attempt to create tables on startup
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("Successfully connected to Database and ensured tables exist.")
    except Exception as e:
        print(f"CRITICAL WARNING: Failed to connect to Database on startup: {e}")
        print("The server is running, but database features will fail until DATABASE_URL is correct.")
        
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


@app.websocket("/ws/matchmaking/{client_id}/{difficulty}")
async def websocket_matchmaking(websocket: WebSocket, client_id: str, difficulty: str):
    await manager.connect(websocket, client_id)
    try:
        # Client joined. Add to Redis queue
        await join_queue(client_id, difficulty)
        # Send acknowledged payload
        await manager.send_json({"event": "queued", "data": {"status": "searching", "difficulty": difficulty}}, client_id)
        
        while True:
            # Keep connection open. Read UI actions like cancellation.
            data = await websocket.receive_text()
            if data == "cancel":
                await leave_queue(client_id)
                await manager.send_json({"event": "cancelled", "data": {}}, client_id)
                
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        try:
            await leave_queue(client_id)
        except Exception:
            pass
    except Exception as e:
        print(f"Fatal Websocket error: {e}")
        manager.disconnect(client_id)


async def db_update_game_result(room_data: dict, winner_client_id: str):
    """
    Updates the database record for both players involved in the match.
    """
    from database import async_session
    async with async_session() as db:
        try:
            players = room_data.get("players", [])
            difficulty = room_data.get("difficulty", "easy")
            xp_gain = 400 if difficulty == "difficult" else (300 if difficulty == "intermediate" else 200)
            
            for p_client_id in players:
                # Retrieve user
                res = await db.execute(select(User).where(User.client_id == p_client_id))
                user = res.scalar_one_or_none()
                if user:
                    user.total_games += 1
                    if p_client_id == winner_client_id:
                        user.wins += 1
                        user.winstreak += 1
                        user.xp += xp_gain
                    else:
                        user.winstreak = 0
            await db.commit()
            print(f"Successfully updated user stats for room {room_data.get('room_id')}", flush=True)
        except Exception as e:
            print(f"Error updating user game stats in DB: {e}", flush=True)
            await db.rollback()


@app.websocket("/ws/arena/{room_id}/{client_id}")
async def websocket_arena(websocket: WebSocket, room_id: str, client_id: str):
    await manager.connect(websocket, client_id)
    
    # Check if room exists
    redis_client = await get_redis()
    room_str = await redis_client.hget("cbr:rooms", room_id)
    if not room_str:
        await websocket.send_json({"event": "room_not_found", "data": {"message": "Arena room not found or expired."}})
        await websocket.close()
        manager.disconnect(client_id)
        return
        
    room_data = json.loads(room_str)
    if room_data.get("status") == "finished":
        # Immediately send game_over event to let them know the game is done
        await websocket.send_json({
            "event": "game_over",
            "data": {"winner": room_data.get("winner")}
        })
        
    manager.join_room(room_id, client_id)
    bot_task = None
    try:
        # Check if practice mode (room only has 1 player)
        players = room_data.get("players", [])
        if len(players) == 1 and room_data.get("status") == "active":
            from bot_simulator import simulate_practice_bot
            bot_task = asyncio.create_task(simulate_practice_bot(room_id))

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
                
                if event_type in ["editor_update", "friend_request"]:
                    # Broadcast this action directly back to the rest of the room
                    await manager.broadcast_to_room(room_id, data, exclude_client=client_id)
                
                elif event_type == "run_code":
                    # Immediate code evaluation without ending the match
                    code = data.get("data", {}).get("code", "")
                    # Retrieve test cases from room data
                    room_str = await redis_client.hget("cbr:rooms", room_id)
                    if not room_str:
                        await manager.send_json({"event": "error", "data": {"message": "Room not found"}}, client_id)
                        continue
                    room_data = json.loads(room_str)
                    test_cases = room_data.get("puzzle", {}).get("test_cases", [])
                    eval_result = await asyncio.to_thread(evaluate_code, code, test_cases)
                    await manager.send_json({"event": "test_run_result", "data": eval_result}, client_id)
                
                elif event_type == "submit_code":
                    code = data.get("data", {}).get("code", "")
                    # Retrieve test cases from room data
                    room_str = await redis_client.hget("cbr:rooms", room_id)
                    if not room_str:
                        await manager.send_json({"event": "error", "data": {"message": "Room not found"}}, client_id)
                        continue
                    room_data = json.loads(room_str)
                    if room_data.get("status") != "active":
                        continue
                    test_cases = room_data.get("puzzle", {}).get("test_cases", [])
                    eval_result = await asyncio.to_thread(evaluate_code, code, test_cases)
                    
                    if eval_result.get("success"):
                        # Mark room as finished and set winner
                        room_data["status"] = "finished"
                        room_data["winner"] = client_id
                        await redis_client.hset("cbr:rooms", room_id, json.dumps(room_data))
                        
                        # Broadcast game_over to the room
                        await manager.broadcast_to_room(room_id, {
                            "event": "game_over",
                            "data": {"winner": client_id}
                        })
                        
                        # Update stats in database
                        asyncio.create_task(db_update_game_result(room_data, client_id))
                    else:
                        # Send test failure details to the submitting client
                        await manager.send_json({
                            "event": "test_failed",
                            "data": {
                                "error_msg": eval_result.get("error_msg"),
                                "failed_test": eval_result.get("failed_test")
                            }
                        }, client_id)
            except json.JSONDecodeError:
                pass
                
    except WebSocketDisconnect:
        manager.leave_room(room_id, client_id)
        manager.disconnect(client_id)
        # Notify opponent of disconnection
        try:
            await manager.broadcast_to_room(
                room_id,
                {"event": "player_left", "data": {"client_id": client_id}}
            )
        except Exception:
            pass
    except Exception as e:
        print(f"Fatal Arena Error: {e}")
        manager.leave_room(room_id, client_id)
        manager.disconnect(client_id)
    finally:
        if bot_task:
            bot_task.cancel()
            try:
                await bot_task
            except asyncio.CancelledError:
                pass

from pydantic import BaseModel
import uuid

class PracticeRequest(BaseModel):
    client_id: str
    difficulty: str = "easy"

@app.post("/api/practice")
async def start_practice(req: PracticeRequest, redis_client: redis.Redis = Depends(get_redis)):
    """
    Creates a single-player room for practicing algorithmic puzzles.
    """
    try:
        room_uuid = str(uuid.uuid4())
        from puzzles import get_puzzle_for_players
        puzzle = await get_puzzle_for_players([req.client_id], redis_client, req.difficulty)
        
        # Strip solution before putting into room data sent to clients
        frontend_puzzle = {k: v for k, v in puzzle.items() if k != "solution"}
        
        room_data = {
            "room_id": room_uuid,
            "players": [req.client_id],
            "status": "active",
            "puzzle": frontend_puzzle,
            "created_at": time.time(),
            "difficulty": req.difficulty
        }
        
        # Store directly in our active rooms
        await redis_client.hset("cbr:rooms", room_uuid, json.dumps(room_data))
        return {"status": "success", "room_data": room_data}
    
    except Exception as e:
        print(f"FATAL REDIS ERROR: {e}")
        return {"status": "error", "message": "Failed to connect to active database infrastructure."}

@app.get("/api/room/{room_id}")
async def get_room(room_id: str, redis_client: redis.Redis = Depends(get_redis)):
    """
    Fetches the current status of a room to check if it's still active.
    """
    room_str = await redis_client.hget("cbr:rooms", room_id)
    if not room_str:
        raise HTTPException(status_code=404, detail="Room not found")
    return json.loads(room_str)

class FriendRequestModel(BaseModel):
    sender_id: str
    sender_name: str
    target_identifier: str

@app.post("/api/friend-request")
async def send_friend_request(req: FriendRequestModel, db: AsyncSession = Depends(get_db), redis_client: redis.Redis = Depends(get_redis)):
    """
    Dispatches a real-time squad request to a target client via WebSocket or stores it in Redis.
    """
    target = req.target_identifier.strip().upper()
    
    # 1. Verify target exists in DB
    from sqlalchemy import func
    result = await db.execute(select(User).where(func.upper(User.username) == target))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Operative callsign not found in database.")
        
    # 2. Prevent sending request to oneself
    if user.client_id == req.sender_id or user.username.upper() == req.sender_name.upper():
        raise HTTPException(status_code=400, detail="Cannot send a squad request to yourself.")
        
    # 3. Verify they are not already friends in DB
    sender_res = await db.execute(select(User).where(User.client_id == req.sender_id))
    sender = sender_res.scalar_one_or_none()
    if sender:
        f_res = await db.execute(select(Friendship).where(
            or_(
                and_(Friendship.user_id == sender.id, Friendship.friend_id == user.id),
                and_(Friendship.user_id == user.id, Friendship.friend_id == sender.id)
            )
        ))
        if f_res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="You are already squad mates with this operative.")
            
    payload = {
        "event": "friend_request",
        "data": {
            "sender_id": req.sender_id,
            "sender_name": req.sender_name,
            "timestamp": time.time()
        }
    }
    
    # Store in Redis so the target client can poll or receive it
    await redis_client.lpush(f"cbr:user:{target}:requests", json.dumps(payload["data"]))
    
    # Also attempt direct real-time socket broadcast if the target is currently connected
    try:
        await manager.send_json(payload, user.client_id)
    except Exception:
        pass
        
    return {"status": "success", "message": f"Squad request dispatched to {target}."}

# Authentication models
class RegisterModel(BaseModel):
    username: str
    password: str

class LoginModel(BaseModel):
    username: str
    password: str

@app.post("/api/auth/register")
async def register_user(payload: RegisterModel, db: AsyncSession = Depends(get_db)):
    """Register a new user with hashed password."""
    # Check if username exists
    result = await db.execute(select(User).where(User.username == payload.username))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    pwd_hash = hash_password(payload.password)
    new_user = User(username=payload.username, password_hash=pwd_hash)
    db.add(new_user)
    await db.commit()
    return {"status": "success", "message": "User registered", "client_id": new_user.client_id}

@app.post("/api/auth/login")
async def login_user(payload: LoginModel, db: AsyncSession = Depends(get_db)):
    """Authenticate user and return basic profile info."""
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(user.password_hash, payload.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {
        "status": "success", 
        "user": {
            "id": user.id, 
            "username": user.username, 
            "xp": user.xp, 
            "wins": user.wins, 
            "total_games": user.total_games,
            "winstreak": user.winstreak,
            "client_id": user.client_id
        }
    }

@app.get("/api/leaderboard")
async def get_leaderboard(db: AsyncSession = Depends(get_db)):
    """Return top users ordered by wins then xp."""
    result = await db.execute(select(User).where(User.total_games > 0).order_by(desc(User.wins), desc(User.xp)).limit(5))
    top_users = result.scalars().all()
    return {
        "status": "success",
        "leaderboard": [{
            "id": u.id,
            "username": u.username,
            "wins": u.wins,
            "xp": u.xp
        } for u in top_users]
    }

@app.get("/api/friend-requests/{client_id}")
async def get_friend_requests(client_id: str, redis_client: redis.Redis = Depends(get_redis)):
    """
    Fetches all pending friend requests for a specific client_id.
    """
    reqs = await redis_client.lrange(f"cbr:user:{client_id.upper()}:requests", 0, -1)
    parsed = [json.loads(r) for r in reqs]
    return {"status": "success", "requests": parsed}

class FriendAcceptModel(BaseModel):
    username: str
    friend_username: str

@app.post("/api/friend-accept")
async def accept_friend_request(req: FriendAcceptModel, db: AsyncSession = Depends(get_db), redis_client: redis.Redis = Depends(get_redis)):
    # 1. Remove the request from Redis queue
    target_key = f"cbr:user:{req.username.strip().upper()}:requests"
    reqs = await redis_client.lrange(target_key, 0, -1)
    for r in reqs:
        parsed = json.loads(r)
        if parsed.get("sender_name", "").upper() == req.friend_username.strip().upper():
            await redis_client.lrem(target_key, 1, r)
            break
            
    # 2. Add friendship to the DB
    u1_res = await db.execute(select(User).where(User.username == req.username))
    u1 = u1_res.scalar_one_or_none()
    u2_res = await db.execute(select(User).where(User.username == req.friend_username))
    u2 = u2_res.scalar_one_or_none()
    
    if not u1 or not u2:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check if friendship already exists
    f_res = await db.execute(select(Friendship).where(
        or_(
            and_(Friendship.user_id == u1.id, Friendship.friend_id == u2.id),
            and_(Friendship.user_id == u2.id, Friendship.friend_id == u1.id)
        )
    ))
    existing_f = f_res.scalar_one_or_none()
    if not existing_f:
        f1 = Friendship(user_id=u1.id, friend_id=u2.id, status="accepted")
        db.add(f1)
        await db.commit()
            
    return {"status": "success", "message": "Squad request accepted."}

@app.get("/api/friends/{username}")
async def get_friends(username: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.username == username))
    user = res.scalar_one_or_none()
    if not user:
        return {"status": "success", "friends": []}
        
    # Get all accepted friendships where user is user_id or friend_id
    f_res = await db.execute(
        select(Friendship)
        .where(
            and_(
                or_(Friendship.user_id == user.id, Friendship.friend_id == user.id),
                Friendship.status == "accepted"
            )
        )
    )
    friendships = f_res.scalars().all()
    
    friend_ids = []
    for f in friendships:
        if f.user_id == user.id:
            friend_ids.append(f.friend_id)
        else:
            friend_ids.append(f.user_id)
            
    if not friend_ids:
        return {"status": "success", "friends": []}
        
    friends_res = await db.execute(select(User).where(User.id.in_(friend_ids)))
    friends = friends_res.scalars().all()
    
    return {
        "status": "success",
        "friends": [{
            "name": f.username,
            "status": "ONLINE // SQUAD SYNCED",
            "online": True,
            "pending": False
        } for f in friends]
    }

@app.get("/api/user/{username}")
async def get_user_stats(username: str, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(User).where(User.username == username))
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "status": "success",
        "user": {
            "id": user.id,
            "username": user.username,
            "xp": user.xp,
            "wins": user.wins,
            "total_games": user.total_games,
            "winstreak": user.winstreak,
            "client_id": user.client_id
        }
    }

