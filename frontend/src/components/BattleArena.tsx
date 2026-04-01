import React, { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { useArena } from '../hooks/useArena';
import './BattleArena.css';

interface PuzzleData {
  id: string;
  title: string;
  description: string;
  initial_code: string;
}

interface BattleArenaProps {
  roomId: string;
  clientId: string;
  puzzleData: PuzzleData;
  isPracticeMode?: boolean;
}

export const BattleArena: React.FC<BattleArenaProps> = ({ roomId, clientId, puzzleData, isPracticeMode = false }) => {
  const { status, opponentCode, sendCodeUpdate, submitSolution, gameStatus, winner, lastErrorMsg } = useArena(roomId, clientId);
  const [myCode, setMyCode] = useState<string>(puzzleData.initial_code || '# Start coding...');

  // Debounce WS sends so we don't bombard the server on every tiny keystroke
  useEffect(() => {
    const timeout = setTimeout(() => {
      // OBFUSCATION: We replace all letters/numbers with block characters 
      // so the opponent can see the *shape* and *speed* of your typing (for tension)
      // but they cannot read the actual code to avoid cheating!
      const obscuredCode = myCode.replace(/[^\s\n]/g, '█');
      sendCodeUpdate(obscuredCode);
    }, 200);
    return () => clearTimeout(timeout);
  }, [myCode, sendCodeUpdate]);

  const handleEditorChange = (value: string) => {
    setMyCode(value);
  };

  return (
    <div className="arena-container glass-panel" style={{ maxWidth: isPracticeMode ? '1000px' : '1400px' }}>
      {/* Game Over Screen Overlay */}
      {gameStatus === 'finished' && (
        <div className="game-over-overlay">
          <div className="game-over-modal glass-panel">
            <h1 className={winner === clientId ? 'victory-text' : 'defeat-text'}>
              {winner === clientId ? 'VICTORY' : 'DEFEAT'}
            </h1>
            <p>{winner === clientId ? 'You passed all test cases!' : 'Your opponent finished the puzzle before you.'}</p>
            <button className="primary-btn" onClick={() => window.location.reload()}>PLAY AGAIN</button>
          </div>
        </div>
      )}

      <header className="arena-header">
        <h2 className="glow-text">{isPracticeMode ? "PRACTICE MODE" : "LIVE COMBAT"}</h2>
        <div className="arena-status">
          <span className={`status-indicator ${status === 'connected' ? 'online' : 'offline'}`}></span>
          {status.toUpperCase()}
        </div>
      </header>

      {/* Puzzle Prompt Panel */}
      <div className="puzzle-prompt glass-panel" style={{ padding: '15px', marginBottom: '10px', background: 'rgba(0,0,0,0.4)', borderLeft: '4px solid var(--accent-cyan)' }}>
        <h3 style={{ margin: '0 0 10px 0', color: 'var(--accent-cyan)' }}>Mission: {puzzleData.title}</h3>
        <p style={{ margin: 0, lineHeight: '1.5', fontFamily: 'monospace' }}>{puzzleData.description}</p>
      </div>

      <div className="arena-split">
        {/* Player's Editor */}
        <div className="editor-pane my-editor">
          <div className="editor-header">
            <h3>Your Console</h3>
            <span className="player-id">ID: {clientId.slice(0, 8)}</span>
          </div>
          <CodeMirror
            value={myCode}
            height="100%"
            theme={oneDark}
            extensions={[python()]}
            onChange={handleEditorChange}
            className="codemirror-wrapper code-glow"
          />
        </div>

        {/* Opponent's Editor (Read Only) */}
        {!isPracticeMode && (
        <div className="editor-pane opponent-editor">
          <div className="editor-header">
            <h3 style={{ color: 'var(--accent-pink)' }}>Opponent's Console</h3>
            <span className="live-badge">LIVE SYNC</span>
          </div>
          <div className="opponent-overlay"></div>
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
        )}
      </div>

      <div className="arena-footer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', paddingTop: '15px' }}>
        {lastErrorMsg && (
            <div className="error-banner" style={{ color: '#ff4444', backgroundColor: 'rgba(255, 0, 0, 0.1)', padding: '10px', borderRadius: '4px', border: '1px solid #ff4444', width: '100%', textAlign: 'center' }}>
                <strong>EXECUTION FAILED:</strong> <br />
                <span style={{fontFamily: 'monospace'}}>{lastErrorMsg}</span>
            </div>
        )}
        <button 
          className="primary-btn pulse submit-btn" 
          disabled={gameStatus !== 'active' || status !== 'connected'}
          onClick={() => submitSolution(myCode)}
        >
          SUBMIT SOLUTION
        </button>
      </div>
    </div>
  );
};
