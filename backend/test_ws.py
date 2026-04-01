import asyncio
import websockets
import json

async def test_client(client_id):
    uri = f"ws://localhost:8000/ws/matchmaking/{client_id}"
    print(f"[{client_id}] Connecting to {uri}")
    async with websockets.connect(uri) as websocket:
        msg1 = await websocket.recv()
        print(f"[{client_id}] Received: {msg1}")
        
        try:
            msg2 = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            print(f"[{client_id}] Received Match: {msg2}")
        except asyncio.TimeoutError:
            print(f"[{client_id}] Timeout waiting for match!")

async def main():
    await asyncio.gather(
        test_client("tester-1"),
        test_client("tester-2")
    )

if __name__ == "__main__":
    asyncio.run(main())
