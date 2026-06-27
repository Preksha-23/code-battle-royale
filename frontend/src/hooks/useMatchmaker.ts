import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

export type MatchStatus = 'idle' | 'connecting' | 'searching' | 'found' | 'error';

export function useMatchmaker() {
    const [status, setStatus] = useState<MatchStatus>(() => {
        const savedRoomId = sessionStorage.getItem('cbr_room_id');
        return savedRoomId ? 'found' : 'idle';
    });
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [clientId] = useState<string>(() => {
        const saved = sessionStorage.getItem('cbr_client_id');
        if (saved) return saved;
        const newId = uuidv4();
        sessionStorage.setItem('cbr_client_id', newId);
        return newId;
    });
    const [roomData, setRoomData] = useState<any>(() => {
        const savedRoomData = sessionStorage.getItem('cbr_room_data');
        return savedRoomData ? JSON.parse(savedRoomData) : null;
    });

    const findMatch = useCallback((difficulty: string = 'easy') => {
        if (!clientId) return;
        setStatus('connecting');
        
        const BASE_WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
        const ws = new WebSocket(`${BASE_WS_URL}/ws/matchmaking/${clientId}/${difficulty}`);

        ws.onopen = () => {
            console.log("Connected to matchmaking server");
        };

        ws.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.event === 'queued') {
                    setStatus('searching');
                } else if (payload.event === 'match_found') {
                    sessionStorage.setItem('cbr_room_id', payload.data.room_id);
                    sessionStorage.setItem('cbr_room_data', JSON.stringify(payload.data));
                    setStatus('found');
                    setRoomData(payload.data);
                } else if (payload.event === 'cancelled') {
                    setStatus('idle');
                    ws.close();
                }
            } catch (err) {
                console.error("Failed to parse websocket message:", err);
            }
        };

        ws.onerror = (error) => {
            console.error("WebSocket Error:", error);
            setStatus('error');
        };

        ws.onclose = () => {
            console.log("Disconnected from matchmaking server");
            if (status !== 'found') {
                setStatus('idle');
            }
        };

        setSocket(ws);
    }, [clientId, status]);

    const cancelMatch = useCallback(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send('cancel');
        }
    }, [socket]);

    const startPractice = useCallback(async (difficulty: string = 'easy') => {
        setStatus('searching');
        try {
            const BASE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(`${BASE_API_URL}/api/practice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ client_id: clientId, difficulty })
            });
            const result = await response.json();
            if (result.status === 'success') {
                sessionStorage.setItem('cbr_room_id', result.room_data.room_id);
                sessionStorage.setItem('cbr_room_data', JSON.stringify(result.room_data));
                setRoomData(result.room_data);
                setStatus('found');
            } else {
                setStatus('error');
            }
        } catch (error) {
            console.error("Practice connection failed", error);
            setStatus('error');
        }
    }, [clientId]);

    return {
        status,
        findMatch,
        cancelMatch,
        startPractice,
        roomData,
        clientId
    };
}

