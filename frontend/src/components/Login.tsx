import React, { useState } from 'react';
import { audioManager } from '../utils/audio';

interface LoginProps {
  onLoginSuccess: (userData: {
    username: string;
    client_id: string;
    xp: number;
    wins: number;
    total_games: number;
    winstreak: number;
  }) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg('All terminal parameters required.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    audioManager.playTickSound();

    try {
      const BASE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      
      const response = await fetch(`${BASE_API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim()
        })
      });

      const data = await response.json();

      if (response.ok) {
        if (isRegister) {
          // Registration succeeded, now login automatically
          const loginResponse = await fetch(`${BASE_API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              username: username.trim(),
              password: password.trim()
            })
          });
          const loginData = await loginResponse.json();
          if (loginResponse.ok) {
            onLoginSuccess(loginData.user);
          } else {
            setErrorMsg(loginData.detail || 'Auto-login failed after registration.');
          }
        } else {
          onLoginSuccess(data.user);
        }
      } else {
        setErrorMsg(data.detail || 'Authorization failed. Check telemetry asserts.');
      }
    } catch (err) {
      console.error('Auth error:', err);
      setErrorMsg('Failed to connect to authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'radial-gradient(circle at center, #0d111a 0%, #05070a 100%)',
      padding: '2rem',
      boxSizing: 'border-box',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 9999
    }}>
      <div className="glass-panel" style={{
        maxWidth: '450px',
        width: '100%',
        padding: '3rem 2.5rem',
        textAlign: 'center',
        border: '1px solid rgba(0, 243, 255, 0.25)',
        boxShadow: '0 0 40px rgba(0, 243, 255, 0.1)',
        borderRadius: '8px',
        background: 'rgba(10, 14, 22, 0.85)',
        backdropFilter: 'blur(20px)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', textShadow: '0 0 15px var(--accent-cyan)' }}>👾</div>
        <h1 style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.8rem',
          fontWeight: 900,
          color: 'var(--accent-cyan)',
          letterSpacing: '0.15em',
          textShadow: '0 0 10px rgba(0, 243, 255, 0.5)',
          margin: '0 0 0.5rem 0'
        }}>
          CODE BATTLE ROYALE
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '0.8rem',
          fontFamily: 'var(--font-mono)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: '2.5rem'
        }}>
          {isRegister ? 'REGISTER NEW OPERATIVE PROTOCOL' : 'AUTHENTICATE UPLINK SECURITY'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'left' }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              color: 'var(--accent-cyan)',
              fontFamily: 'var(--font-mono)',
              marginBottom: '0.5rem',
              letterSpacing: '0.05em'
            }}>
              OPERATOR CALLSIGN (USERNAME):
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. NEO_CODER"
              style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(0, 243, 255, 0.3)',
                color: '#fff',
                padding: '0.75rem 1rem',
                fontFamily: 'var(--font-mono)',
                borderRadius: '4px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-cyan)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(0, 243, 255, 0.3)'}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              color: 'var(--accent-cyan)',
              fontFamily: 'var(--font-mono)',
              marginBottom: '0.5rem',
              letterSpacing: '0.05em'
            }}>
              SECURITY ACCESS DECRYPT KEY (PASSWORD):
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%',
                background: 'rgba(0, 0, 0, 0.6)',
                border: '1px solid rgba(0, 243, 255, 0.3)',
                color: '#fff',
                padding: '0.75rem 1rem',
                fontFamily: 'var(--font-mono)',
                borderRadius: '4px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-cyan)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(0, 243, 255, 0.3)'}
            />
          </div>

          {errorMsg && (
            <div style={{
              color: 'var(--accent-pink)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              background: 'rgba(255, 0, 127, 0.08)',
              border: '1px solid rgba(255, 0, 127, 0.25)',
              padding: '0.6rem 1rem',
              borderRadius: '4px',
              textAlign: 'center'
            }}>
              CRITICAL ERROR // {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="action-submit-btn"
            style={{
              width: '100%',
              padding: '0.9rem',
              fontSize: '0.9rem',
              marginTop: '0.5rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? 'ESTABLISHING SECURE LINK...' : isRegister ? 'INITIALIZE RECRUIT' : 'ESTABLISH SECURE LINK'}
          </button>
        </form>

        <div style={{ marginTop: '2rem' }}>
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setErrorMsg('');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {isRegister ? 'EXISTING OPERATIVE? LOGIN HERE' : 'NEW OPERATIVE? REGISTER CALLSIGN'}
          </button>
        </div>
      </div>
    </div>
  );
};
