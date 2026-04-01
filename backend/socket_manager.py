from fastapi import WebSocket
from typing import Dict, Any
import json
import logging

logger = logging.getLogger("socket_manager")

class ConnectionManager:
    """Manages active WebSocket connections in server memory."""

    def __init__(self):
        # Maps client_id -> WebSocket
        self.active_connections: Dict[str, WebSocket] = {}
        # Maps room_id -> set of client_ids inside the room
        self.rooms: Dict[str, set] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        print(f"Client {client_id} connected via sockets.", flush=True)

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            print(f"Client {client_id} disconnected.", flush=True)
            
            # Clean up room records
            for room_id, clients in list(self.rooms.items()):
                if client_id in clients:
                    clients.remove(client_id)
                    if not clients:
                        del self.rooms[room_id]

    # Room-specific tracking
    def join_room(self, room_id: str, client_id: str):
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(client_id)
        print(f"Client {client_id} joined room {room_id}.", flush=True)

    def leave_room(self, room_id: str, client_id: str):
        if room_id in self.rooms and client_id in self.rooms[room_id]:
            self.rooms[room_id].remove(client_id)
            if not self.rooms[room_id]:
                del self.rooms[room_id]

    async def broadcast_to_room(self, room_id: str, data: dict, exclude_client: str = None):
        """Sends JSON data to everyone in a specific room, optionally excluding the sender"""
        if room_id in self.rooms:
            for c_id in self.rooms[room_id]:
                if c_id != exclude_client and c_id in self.active_connections:
                    try:
                        await self.active_connections[c_id].send_json(data)
                    except Exception as e:
                        print(f"Failed to broadcast to {c_id} in {room_id}: {e}")

    async def send_personal_message(self, message: str, client_id: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections.values():
            await connection.send_text(message)

    async def send_json(self, data: dict, client_id: str):
        print(f"Attempting to send_json to {client_id}. Active={list(self.active_connections.keys())}", flush=True)
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(data)
                print(f"Successfully sent JSON to {client_id}", flush=True)
            except Exception as e:
                print(f"Failed to send JSON to {client_id}: {e}", flush=True)
        else:
            print(f"WARNING: {client_id} not in connections!", flush=True)

# Global connection manager
manager = ConnectionManager()
