import React, { useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { useArena } from '../hooks/useArena';
import { audioManager } from '../utils/audio';
import './BattleArena.css';

interface PuzzleData {
  id: string;
  title: string;
  description: string;
  initial_code: string;
  test_cases?: string[];
}

interface BattleArenaProps {
  roomId: string;
  clientId: string;
  puzzleData: PuzzleData;
  isPracticeMode?: boolean;
  createdAt?: number;
}

export const BattleArena: React.FC<BattleArenaProps> = ({ roomId, clientId, puzzleData, isPracticeMode = false, createdAt }) => {
  const { status, opponentCode, sendCodeUpdate, submitSolution, sendFriendRequest, gameStatus, winner, lastErrorMsg, failedTest } = useArena(roomId, clientId);
  const [friendReqSent, setFriendReqSent] = useState(false);
  
  const [myCode, setMyCode] = useState<string>(() => {
    const saved = sessionStorage.getItem(`cbr_code_${roomId}`);
    return saved !== null ? saved : (puzzleData.initial_code || '# Start coding...');
  });
  
  // Timer state based on creation time to handle page reload
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (createdAt) {
      const elapsed = Math.floor(Date.now() / 1000 - createdAt);
      const remaining = 300 - elapsed;
      return Math.max(0, remaining);
    }
    return 300; // default 5 minutes
  });
  
  const [timerActive, setTimerActive] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(() => audioManager.isMuted());

  // Refs to prevent duplicate sounds
  const startSoundPlayed = useRef(false);
  const endSoundPlayed = useRef(false);

  // Debounce WS sends so we don't bombard the server on every tiny keystroke
  useEffect(() => {
    const timeout = setTimeout(() => {
      // OBFUSCATION: Replace all letters/numbers with block characters
      const obscuredCode = myCode.replace(/[^\s\n]/g, '█');
      sendCodeUpdate(obscuredCode);
    }, 200);
    return () => clearTimeout(timeout);
  }, [myCode, sendCodeUpdate]);

  // Handle countdown timer ticking
  useEffect(() => {
    if (gameStatus !== 'active' || status !== 'connected' || !timerActive) return;
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerActive(false);
          return 0;
        }
        
        const nextTime = prev - 1;
        // Rhythmic tick warning under 30 seconds
        if (nextTime <= 30) {
          audioManager.playTickSound();
          if (nextTime % 5 === 0) {
            audioManager.playWarningSound();
          }
        }
        
        return nextTime;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [gameStatus, status, timerActive]);

  // Play start sound once connected
  useEffect(() => {
    if (status === 'connected' && gameStatus === 'active' && !startSoundPlayed.current) {
      startSoundPlayed.current = true;
      audioManager.playStartSound();
    }
  }, [status, gameStatus]);

  // Play game over sounds and award dynamic XP telemetry
  useEffect(() => {
    const resolvedWinner = timeLeft === 0 ? 'cyber_bot_3000' : winner;
    const resolvedFinished = gameStatus === 'finished' || timeLeft === 0;

    if (resolvedFinished && !endSoundPlayed.current) {
      endSoundPlayed.current = true;
      setTimerActive(false);
      if (resolvedWinner === clientId) {
        audioManager.playVictorySound();
        
        // Dynamic XP & Win Telemetry Tracking
        const currentXP = parseInt(localStorage.getItem('cbr_xp') || '8450', 10);
        const addedXP = puzzleData.id ? 400 : 250;
        localStorage.setItem('cbr_xp', (currentXP + addedXP).toString());
        
        const currentWins = parseInt(localStorage.getItem('cbr_wins') || '42', 10);
        localStorage.setItem('cbr_wins', (currentWins + 1).toString());
        
        const currentStreak = parseInt(localStorage.getItem('cbr_winstreak') || '12', 10);
        localStorage.setItem('cbr_winstreak', (currentStreak + 1).toString());
      } else {
        audioManager.playDefeatSound();
        localStorage.setItem('cbr_winstreak', '0');
      }
    }
  }, [gameStatus, winner, timeLeft, clientId, puzzleData]);

  const handleEditorChange = (value: string) => {
    setMyCode(value);
    sessionStorage.setItem(`cbr_code_${roomId}`, value);
  };

  const handleToggleMute = () => {
    const muted = audioManager.toggleMute();
    setIsMuted(muted);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayAgain = () => {
    sessionStorage.removeItem('cbr_room_id');
    sessionStorage.removeItem('cbr_room_data');
    sessionStorage.removeItem(`cbr_code_${roomId}`);
    window.location.reload();
  };

  const handleExit = () => {
    if (window.confirm("Are you sure you want to abandon this combat session?")) {
      sessionStorage.removeItem('cbr_room_id');
      sessionStorage.removeItem('cbr_room_data');
      sessionStorage.removeItem(`cbr_code_${roomId}`);
      window.location.reload();
    }
  };

  // Determine game results
  const finalWinner = timeLeft === 0 ? 'cyber_bot_3000' : winner;
  const isGameOver = gameStatus === 'finished' || timeLeft === 0;

  // Test cases feedback processing
  const testCases = puzzleData.test_cases || [];
  let passedCount = 0;
  let failedTestCaseIdx = -1;
  if (finalWinner === clientId) {
    passedCount = testCases.length;
  } else if (failedTest) {
    failedTestCaseIdx = testCases.findIndex(tc => tc.trim() === failedTest.trim());
    if (failedTestCaseIdx === -1) {
      failedTestCaseIdx = testCases.findIndex(tc => tc.includes(failedTest) || failedTest.includes(tc));
    }
    passedCount = failedTestCaseIdx !== -1 ? failedTestCaseIdx : 0;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 58px)', width: '100%', padding: '1rem', gap: '1rem', background: 'var(--bg-color)' }}>
      {/* Game Over Screen Overlay */}
      {isGameOver && (
        <div className="game-over-overlay">
          <div className="game-over-modal glass-panel">
            <h1 className={finalWinner === clientId ? 'victory-text' : 'defeat-text'}>
              {finalWinner === clientId ? 'VICTORY' : 'DEFEAT'}
            </h1>
            <p style={{ fontSize: '1.2rem', marginBottom: '25px' }}>
              {timeLeft === 0 
                ? 'Time ran out! Your console has shutdown.' 
                : finalWinner === clientId 
                  ? 'You passed all test cases!' 
                  : isPracticeMode 
                    ? 'The training AI solved the puzzle before you.'
                    : 'Your opponent finished the puzzle before you.'}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="action-submit-btn" onClick={handlePlayAgain}>PLAY AGAIN</button>
              {!isPracticeMode && (
                <button 
                  className="new-duel-btn" 
                  style={{ marginTop: 0, padding: '0.8rem 1.5rem' }} 
                  disabled={friendReqSent}
                  onClick={() => {
                    const opName = localStorage.getItem('cbr_operator_name') || `OPERATOR_${clientId.substring(0, 4).toUpperCase()}`;
                    sendFriendRequest(opName);
                    setFriendReqSent(true);
                  }}
                >
                  {friendReqSent ? 'SQUAD REQUEST SENT' : 'ADD SQUAD MATE'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Connection Error Overlay */}
      {status === 'error' && (
        <div className="game-over-overlay">
          <div className="game-over-modal glass-panel">
            <h1 className="defeat-text" style={{ color: 'var(--accent-pink)' }}>UPLINK FAULT</h1>
            <p style={{ fontSize: '1.2rem', marginBottom: '25px', color: 'var(--text-secondary)' }}>
              {lastErrorMsg || 'Uplink to combat arena was terminated or has expired.'}
            </p>
            <button className="action-submit-btn" onClick={handlePlayAgain}>RETURN TO LOBBY</button>
          </div>
        </div>
      )}

      {/* Arena Top Sub-Bar */}
      <div className="glass-panel" style={{ padding: '0.6rem 1.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(10, 14, 22, 0.8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontFamily: 'var(--font-heading)', color: 'var(--accent-cyan)', fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.1em' }}>
            {isPracticeMode ? "TRAINING ARENA" : "LIVE COMBAT PROTOCOL"}
          </span>
          <button 
            onClick={handleExit}
            style={{
              padding: '0.2rem 0.6rem',
              fontSize: '0.7rem',
              border: '1px solid var(--accent-pink)',
              color: 'var(--accent-pink)',
              backgroundColor: 'transparent',
              borderRadius: '4px',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)'
            }}
          >
            ABANDON
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <button onClick={handleToggleMute} style={{ background: 'transparent', border: 'none', boxShadow: 'none', cursor: 'pointer', fontSize: '1rem' }} title={isMuted ? "Unmute Audio" : "Mute Audio"}>
            {isMuted ? '🔇' : '🔊'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--accent-green)' }}>
            <span className={`status-indicator ${status === 'connected' ? 'online' : 'offline'}`}></span>
            <span>{status.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Main Grid HUD */}
      <div className="arena-hud-layout">
        {/* Left Column: Tactical Mission Description */}
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', background: 'rgba(0,243,255,0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid rgba(0,243,255,0.3)' }}>
              [ MISSION: {puzzleData.id.toUpperCase()} ] ID: 0xF722
            </span>
          </div>

          <h2 style={{ fontSize: '1.4rem', color: '#fff', margin: 0, fontFamily: 'var(--font-heading)' }}>
            {puzzleData.title}
          </h2>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.6', margin: 0 }}>
            {puzzleData.description}
          </p>

          {/* Test Case Example Box */}
          {testCases.length > 0 && (
            <div style={{ background: 'rgba(0, 0, 0, 0.5)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '4px', padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', letterSpacing: '0.1em' }}>EXAMPLE 01:</span>
              <code style={{ fontSize: '0.75rem', color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                {testCases[0]}
              </code>
            </div>
          )}

          <div style={{ background: 'rgba(0, 243, 255, 0.03)', borderLeft: '3px solid var(--accent-cyan)', padding: '0.8rem', borderRadius: '0 4px 4px 0', marginTop: 'auto' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', display: 'block', marginBottom: '0.2rem' }}>TACTICAL NOTE:</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Ensure your function handles edge cases cleanly and executes within the time quantum.
            </span>
          </div>
        </div>

        {/* Central Vertical Clock Divider Column */}
        <div className="vertical-clock-column glass-panel">
          <span className="vertical-clock-text">REMAINING_TIME</span>
          <span className={`vertical-clock-digits ${timeLeft <= 30 ? 'critical' : ''}`}>
            {formatTime(timeLeft)}
          </span>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: timeLeft <= 30 ? 'var(--accent-pink)' : 'var(--accent-cyan)', boxShadow: '0 0 8px currentColor' }}></div>
        </div>

        {/* Right Column: Code Consoles Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
          {/* Top Player Console */}
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '0.5rem 1rem', background: 'rgba(0, 0, 0, 0.4)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', letterSpacing: '0.1em' }}>
                💻 LOCAL_BUFFER: SOLUTION.PY
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {clientId.slice(0, 8).toUpperCase()}</span>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
              <CodeMirror
                value={myCode}
                height="100%"
                theme={oneDark}
                extensions={[python()]}
                onChange={handleEditorChange}
                className="codemirror-wrapper code-glow"
              />
            </div>
          </div>

          {/* Bottom Opponent Stream */}
          {(!isPracticeMode || status === 'connected') && (
            <div className="glass-panel" style={{ flex: 0.8, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '0.5rem 1rem', background: 'rgba(0, 0, 0, 0.4)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-pink)', letterSpacing: '0.1em' }}>
                  📡 TARGET_STREAM: {isPracticeMode ? 'CYBERBOT_SIMULATION' : 'LIVE_TELEMETRY'}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--accent-green)', background: 'rgba(0,255,170,0.1)', padding: '0.1rem 0.4rem', borderRadius: '2px' }}>LIVE</span>
              </div>
              <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left', opacity: 0.7 }}>
                <CodeMirror
                  value={opponentCode}
                  height="100%"
                  theme={oneDark}
                  extensions={[python()]}
                  editable={false}
                  readOnly={true}
                  className="codemirror-wrapper opponent-glow"
                />
              </div>
            </div>
          )}
        </div>

        {/* Bottom Diagnostic & Action Console */}
        <div className="bottom-diagnostic-bar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', textAlign: 'left' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>TEST STATUS</span>
            <span style={{ fontSize: '0.95rem', fontFamily: 'var(--font-heading)', color: passedCount === testCases.length && testCases.length > 0 ? 'var(--accent-green)' : 'var(--accent-cyan)' }}>
              [ PASSED: {passedCount}/{testCases.length} ]
            </span>
          </div>

          <div className="terminal-stream">
            <div>[ 00:01:02 ] :: INITIALIZING NEURAL COMPILER...</div>
            {lastErrorMsg ? (
              <div style={{ color: 'var(--accent-pink)', marginTop: '0.2rem' }}>
                {'> '}INTEGRITY FAULT: {lastErrorMsg}
              </div>
            ) : (
              <div style={{ color: 'var(--accent-green)', marginTop: '0.2rem' }}>
                {'> '}Ready for execution sequence. No syntax errors detected.
              </div>
            )}
          </div>

          <div className="execute-btn-group">
            <button className="new-duel-btn" style={{ marginTop: 0, padding: '0.8rem 1.2rem', fontSize: '0.75rem' }} onClick={() => submitSolution(myCode)} disabled={isGameOver || status !== 'connected'}>
              RUN_TESTS
            </button>
            <button className="action-submit-btn" disabled={isGameOver || status !== 'connected'} onClick={() => submitSolution(myCode)}>
              SUBMIT_CODE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
