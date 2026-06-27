import { useState, useEffect, useCallback, useRef } from 'react';

export interface ArenaState {
    status: 'connecting' | 'connected' | 'error' | 'disconnected';
    opponentCode: string;
    gameStatus: 'active' | 'finished';
    winner?: string;
    lastErrorMsg?: string;
    failedTest?: string;
}

export function useArena(roomId: string, clientId: string) {
    const [state, setState] = useState<ArenaState>({
        status: 'connecting',
        opponentCode: '# Waiting for opponent to type...',
        gameStatus: 'active'
    });
    
    const socketRef = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (!roomId || !clientId) return;

        const BASE_WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
        const wsUrl = `${BASE_WS_URL}/ws/arena/${roomId}/${clientId}`;
        const ws = new WebSocket(wsUrl);
        socketRef.current = ws;

        ws.onopen = () => {
            console.log("Connected to Arena WS");
            setState(s => ({ ...s, status: 'connected' }));
        };

        ws.onmessage = (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.event === 'editor_update') {
                    setState(s => ({ ...s, opponentCode: payload.data.code, lastErrorMsg: undefined, failedTest: undefined }));
                } else if (payload.event === 'player_left') {
                    setState(s => ({ ...s, opponentCode: '# Opponent disconnected!' }));
                } else if (payload.event === 'test_failed') {
                    setState(s => ({ ...s, lastErrorMsg: payload.data.error_msg, failedTest: payload.data.failed_test }));
                } else if (payload.event === 'room_not_found') {
                    setState(s => ({ ...s, status: 'error', lastErrorMsg: payload.data.message }));
                } else if (payload.event === 'game_over') {
                    setState(s => ({ ...s, gameStatus: 'finished', winner: payload.data.winner }));
                } else if (payload.event === 'friend_request') {
                    // When a friend request is received, store it only for the target user.
                    // The sender will handle its own UI state via a separate flag.
                    const senderName = payload.data?.sender_name || 'OPPONENT';
                    let existingStr = localStorage.getItem('cbr_friends');
                    let existing = existingStr ? JSON.parse(existingStr) : [];
                    if (!existing.some((f: any) => f.name === senderName)) {
                        existing.push({ name: senderName, status: 'REQUEST RECEIVED // INCOMING', online: true, pending: true });
                        localStorage.setItem('cbr_friends', JSON.stringify(existing));
                        sessionStorage.setItem('cbr_friends', JSON.stringify(existing));
                    }
                }
            } catch (err) {
                console.error("Failed to parse arena message:", err);
            }
        };

        ws.onclose = () => {
            console.log("Disconnected from Arena WS");
            setState(s => ({ ...s, status: 'disconnected' }));
        };

        ws.onerror = (error) => {
            console.error("Arena WS Error:", error);
            setState(s => ({ ...s, status: 'error' }));
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                ws.close();
            }
        };
    }, [roomId, clientId]);

    const sendCodeUpdate = useCallback((code: string) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                event: 'editor_update',
                data: { code }
            }));
        }
    }, []);

    const submitSolution = useCallback((code: string) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                event: 'submit_code',
                data: { code }
            }));
        }
    }, []);

    const sendFriendRequest = useCallback((senderName: string) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({
                event: 'friend_request',
                data: { sender_id: clientId, sender_name: senderName }
            }));
        }
    }, [clientId]);

    return {
        ...state,
        sendCodeUpdate,
        submitSolution,
        sendFriendRequest
    };
}
