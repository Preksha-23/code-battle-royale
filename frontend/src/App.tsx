import { useMatchmaker } from './hooks/useMatchmaker';
import { BattleArena } from './components/BattleArena';
import './App.css';

function App() {
  const { status, findMatch, cancelMatch, startPractice, roomData, clientId } = useMatchmaker();

  // Switch to Battle Arena immediately when a match is found
  if (status === 'found' && roomData) {
      const isPractice = roomData.players && roomData.players.length === 1;
      return (
          <div className="app-container">
              <BattleArena roomId={roomData.room_id} clientId={clientId} puzzleData={roomData.puzzle} isPracticeMode={isPractice} />
          </div>
      );
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title glow-text">Code Battle Royale</h1>
        <p className="subtitle">Real-time 1v1 Coding Arena</p>
      </header>

      <main className="main-content">
        <div className="glass-panel matchmaking-panel">
          {status === 'idle' && (
            <>
              <h2 className="panel-title gradient-text">Enter the Arena</h2>
              <p className="panel-desc">Connect to the matchmaking server and face your opponent.</p>
              <div className="game-modes">
                <button className="primary-btn pulse" onClick={findMatch}>Find Match</button>
                <button className="secondary-btn" onClick={startPractice}>Practice</button>
              </div>
            </>
          )}

          {status === 'searching' && (
            <>
              <h2 className="panel-title gradient-text glow-pulse-fast">Scanning...</h2>
              <p className="panel-desc">Triangulating optimal opponent frequencies.</p>
              <div className="game-modes">
                <button className="secondary-btn" onClick={cancelMatch}>Cancel Search</button>
              </div>
            </>
          )}
          
           {status === 'error' && (
            <>
              <h2 className="panel-title gradient-text" style={{color: 'red'}}>System Error</h2>
              <p className="panel-desc">Failed to connect to matchmaking server.</p>
              <div className="game-modes">
                <button className="primary-btn pulse" onClick={findMatch}>Retry Connection</button>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="footer">
        <p>Cyberpunk Edition // System Online</p>
      </footer>
    </div>
  )
}

export default App;
