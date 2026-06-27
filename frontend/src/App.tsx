import { useState, useEffect } from 'react';
import { useMatchmaker } from './hooks/useMatchmaker';
import { BattleArena } from './components/BattleArena';
import { Login } from './components/Login';
import { audioManager } from './utils/audio';
import './App.css';

interface Friend {
  name: string;
  status: string;
  online: boolean;
  pending?: boolean;
  incoming?: boolean;
}

function App() {
  const { status, findMatch, cancelMatch, startPractice, roomData, clientId } = useMatchmaker();
  const [difficulty, setDifficulty] = useState<'easy' | 'intermediate' | 'difficult'>('easy');
  const [activeNavTab, setActiveNavTab] = useState<'lobby' | 'arena' | 'training'>('lobby');
  const [sidebarView, setSidebarView] = useState<'battles' | 'friends' | 'history' | 'stats'>('battles');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return sessionStorage.getItem('cbr_username') !== null;
  });

  // Dynamic User Customization State
  const [operatorName, setOperatorName] = useState<string>(() => {
    return sessionStorage.getItem('cbr_username') || '';
  });

  // Player XP & Level Telemetry State (Fresh Accounts start cleanly at 0 XP / Level 1)
  const [playerXP, setPlayerXP] = useState<number>(0);
  const [playerWins, setPlayerWins] = useState<number>(0);
  const [playerTotalGames, setPlayerTotalGames] = useState<number>(0);
  const [playerWinstreak, setPlayerWinstreak] = useState<number>(0);

  // Interactive Friends List State with Request Verification
  const [friendsList, setFriendsList] = useState<Friend[]>([]);
  const [newFriendInput, setNewFriendInput] = useState<string>('');
  const [searchStatus, setSearchStatus] = useState<string>('');
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);

  // Periodic polling for stats, leaderboard, friends list, and requests
  useEffect(() => {
    if (!isLoggedIn || !operatorName) return;

    const fetchAllData = async () => {
      try {
        const BASE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        
        // 1. Fetch user stats
        const statsRes = await fetch(`${BASE_API_URL}/api/user/${operatorName}`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          if (statsData.user) {
            setPlayerXP(statsData.user.xp);
            setPlayerWins(statsData.user.wins);
            setPlayerTotalGames(statsData.user.total_games);
            setPlayerWinstreak(statsData.user.winstreak);
            localStorage.setItem('cbr_xp', statsData.user.xp.toString());
            localStorage.setItem('cbr_wins', statsData.user.wins.toString());
            localStorage.setItem('cbr_total_games', statsData.user.total_games.toString());
            localStorage.setItem('cbr_winstreak', statsData.user.winstreak.toString());
          }
        }

        // 2. Fetch leaderboard
        const lbRes = await fetch(`${BASE_API_URL}/api/leaderboard`);
        if (lbRes.ok) {
          const lbData = await lbRes.json();
          setLeaderboardData(lbData.leaderboard || []);
        }

        // 3. Fetch friends
        const friendsRes = await fetch(`${BASE_API_URL}/api/friends/${operatorName}`);
        let accepted = [];
        if (friendsRes.ok) {
          const friendsData = await friendsRes.json();
          accepted = friendsData.friends || [];
        }

        // 4. Fetch incoming requests
        const requestsRes = await fetch(`${BASE_API_URL}/api/friend-requests/${operatorName}`);
        let incoming = [];
        if (requestsRes.ok) {
          const requestsData = await requestsRes.json();
          incoming = (requestsData.requests || []).map((r: any) => ({
            name: r.sender_name,
            status: 'REQUEST RECEIVED // INCOMING',
            online: true,
            pending: true,
            incoming: true
          }));
        }

        // 5. Outgoing requests from localStorage
        const sentStr = localStorage.getItem('cbr_sent_requests');
        let sent = sentStr ? JSON.parse(sentStr) : [];
        // Filter out any sent request that has been accepted
        sent = sent.filter((name: string) => !accepted.some((f: any) => f.name.toUpperCase() === name.toUpperCase()));
        localStorage.setItem('cbr_sent_requests', JSON.stringify(sent));

        const outgoing = sent.map((name: string) => ({
          name: name.toUpperCase(),
          status: 'REQUEST SENT // PENDING ACCEPTANCE',
          online: true,
          pending: true,
          incoming: false
        }));

        // Merge all into friends list
        // Prevent duplicate names by favoring accepted over requests
        const merged: Friend[] = [];
        const seen = new Set<string>();

        // Add accepted first
        accepted.forEach((f: any) => {
          merged.push(f);
          seen.add(f.name.toUpperCase());
        });

        // Add incoming requests if not already added
        incoming.forEach((f: any) => {
          if (!seen.has(f.name.toUpperCase())) {
            merged.push(f);
            seen.add(f.name.toUpperCase());
          }
        });

        // Add outgoing requests if not already added
        outgoing.forEach((f: any) => {
          if (!seen.has(f.name.toUpperCase())) {
            merged.push(f);
            seen.add(f.name.toUpperCase());
          }
        });

        setFriendsList(merged);
      } catch (err) {
        console.error("Data poll error:", err);
      }
    };

    fetchAllData();
    const interval = setInterval(fetchAllData, 5000);
    return () => clearInterval(interval);
  }, [isLoggedIn, operatorName]);

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendInput.trim()) return;
    
    const targetName = newFriendInput.trim().toUpperCase();
    setSearchStatus('SEARCHING OPERATIVE DATABASE...');
    audioManager.playTickSound();

    try {
      const BASE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${BASE_API_URL}/api/friend-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sender_id: clientId,
          sender_name: operatorName,
          target_identifier: targetName
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        // Save to outgoing requests in localStorage
        const sentStr = localStorage.getItem('cbr_sent_requests');
        const sent = sentStr ? JSON.parse(sentStr) : [];
        if (!sent.some((name: string) => name.toUpperCase() === targetName)) {
          sent.push(targetName);
          localStorage.setItem('cbr_sent_requests', JSON.stringify(sent));
        }

        setNewFriendInput('');
        setSearchStatus('OUTGOING SQUAD REQUEST DISPATCHED!');
        setTimeout(() => setSearchStatus(''), 3000);
      } else {
        setSearchStatus(`ERROR: ${data.detail || 'Dispatch failed.'}`);
      }
    } catch (err) {
      console.error(err);
      setSearchStatus('ERROR: CONNECTION TO UPLINK FAILED.');
    }
  };

  const handleAcceptFriend = async (friendName: string) => {
    audioManager.playTickSound();
    try {
      const BASE_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const response = await fetch(`${BASE_API_URL}/api/friend-accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: operatorName,
          friend_username: friendName
        })
      });
      if (response.ok) {
        // Optimistically update friends list immediately
        setFriendsList(prev => prev.map(f => {
          if (f.name.toUpperCase() === friendName.toUpperCase()) {
            return { ...f, pending: false, status: 'ONLINE // SQUAD SYNCED' };
          }
          return f;
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoginSuccess = (user: any) => {
    sessionStorage.setItem('cbr_client_id', user.client_id);
    sessionStorage.setItem('cbr_username', user.username);
    localStorage.setItem('cbr_operator_name', user.username);
    setOperatorName(user.username);
    setPlayerXP(user.xp);
    setPlayerWins(user.wins);
    setPlayerTotalGames(user.total_games);
    setPlayerWinstreak(user.winstreak);
    setIsLoggedIn(true);
    window.location.reload();
  };

  const handleLogout = () => {
    sessionStorage.clear();
    localStorage.removeItem('cbr_operator_name');
    setIsLoggedIn(false);
    window.location.reload();
  };

  // Compute Rank Title and Level
  const getRankAndLevel = (xp: number) => {
    const level = Math.floor(xp / 200) + 1;
    let rankTitle = 'RECRUIT';
    if (xp >= 10000) rankTitle = 'ELITE DIVISION I';
    else if (xp >= 7500) rankTitle = 'ELITE DIVISION II';
    else if (xp >= 5000) rankTitle = 'ELITE DIVISION III';
    else if (xp >= 2500) rankTitle = 'CYBER OPERATOR';
    return { level, rankTitle };
  };

  const { level, rankTitle } = getRankAndLevel(playerXP);
  const winRatio = playerTotalGames > 0 ? ((playerWins / playerTotalGames) * 100).toFixed(1) : '0.0';


  // Matchmaking radar ping loop
  useEffect(() => {
    if (status !== 'searching' && status !== 'connecting') return;
    
    audioManager.playMatchmakingSound();
    const interval = setInterval(() => {
      audioManager.playMatchmakingSound();
    }, 2500);
    
    return () => clearInterval(interval);
  }, [status]);

  // Automatically switch active tab when room is found
  useEffect(() => {
    if (status === 'found') {
      setActiveNavTab('arena');
    }
  }, [status]);

  const handleTrainingTabClick = () => {
    setActiveNavTab('arena');
    if (status !== 'found') {
      startPractice(difficulty);
    }
  };

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-layout">
      {/* Top Navbar */}
      <header className="top-navbar">
        <div className="brand-section">
          <h1 className="brand-title" style={{ cursor: 'pointer' }} onClick={() => { setActiveNavTab('lobby'); setSidebarView('battles'); }}>
            CODE BATTLE ROYALE
          </h1>
        </div>

        <nav className="nav-tabs">
          <button 
            className={`nav-tab ${activeNavTab === 'lobby' ? 'active' : ''}`}
            onClick={() => setActiveNavTab('lobby')}
          >
            LOBBY
          </button>
          <button 
            className={`nav-tab ${activeNavTab === 'arena' ? 'active' : ''}`}
            onClick={() => setActiveNavTab('arena')}
          >
            ARENA
          </button>
          <button 
            className={`nav-tab ${activeNavTab === 'training' ? 'active' : ''}`}
            onClick={handleTrainingTabClick}
          >
            TRAINING
          </button>
        </nav>

        <div className="operator-badge-container">
          <div className="telemetry-chip">
            <span>⚡</span> LATENCY: 12MS
          </div>
          <div className="operator-chip" style={{ cursor: 'pointer' }} onClick={() => setIsSettingsOpen(true)} title="Click to Edit Callsign">
            <div className="operator-avatar">{operatorName.charAt(0).toUpperCase()}</div>
            <div className="operator-details">
              <span className="operator-rank">{rankTitle}</span>
              <span className="operator-name">{operatorName}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="workspace-body">
        {/* Left Tactical Sidebar */}
        <aside className="tactical-sidebar">
          <div className="sidebar-menu">
            <button 
              className={`sidebar-btn ${sidebarView === 'battles' ? 'active' : ''}`}
              onClick={() => { setSidebarView('battles'); setActiveNavTab('lobby'); }}
            >
              <span>⚔️</span> BATTLES
            </button>
            <button 
              className={`sidebar-btn ${sidebarView === 'friends' ? 'active' : ''}`}
              onClick={() => setSidebarView('friends')}
            >
              <span>👥</span> FRIENDS
            </button>
            <button 
              className={`sidebar-btn ${sidebarView === 'history' ? 'active' : ''}`}
              onClick={() => setSidebarView('history')}
            >
              <span>📜</span> HISTORY
            </button>
            <button 
              className={`sidebar-btn ${sidebarView === 'stats' ? 'active' : ''}`}
              onClick={() => setSidebarView('stats')}
            >
              <span>📊</span> STATS
            </button>
          </div>

          <button className="new-duel-btn" onClick={() => { setActiveNavTab('lobby'); setSidebarView('battles'); findMatch(difficulty); }}>
            + NEW DUEL
          </button>

          <button className="sidebar-btn" style={{ marginTop: 'auto' }} onClick={() => setIsSettingsOpen(true)}>
            <span>⚙️</span> SETTINGS
          </button>
        </aside>

        {/* Central Main Stage */}
        <main className="main-stage">
          {/* Settings Modal Overlay */}
          {isSettingsOpen && (
            <div className="game-over-overlay">
              <div className="game-over-modal glass-panel" style={{ width: '450px', textAlign: 'left' }}>
                <h2 style={{ color: 'var(--accent-cyan)', margin: '0 0 1rem 0' }}>SYSTEM_SETTINGS</h2>
                
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem' }}>
                    OPERATOR CALLSIGN / USERNAME:
                  </label>
                  <input 
                    type="text" 
                    value={operatorName} 
                    disabled={true}
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.6)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-muted)',
                      padding: '0.6rem',
                      fontFamily: 'var(--font-mono)',
                      borderRadius: '4px',
                      outline: 'none',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#fff' }}>COMBAT AUDIO FX:</span>
                  <button onClick={() => audioManager.toggleMute()} style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}>
                    TOGGLE SOUND
                  </button>
                </div>

                <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#fff' }}>SESSION:</span>
                  <button onClick={handleLogout} style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', backgroundColor: 'var(--accent-pink)', border: 'none', color: '#fff' }}>
                    LOGOUT PROTOCOL
                  </button>
                </div>

                <button className="action-submit-btn" style={{ width: '100%' }} onClick={() => setIsSettingsOpen(false)}>
                  SAVE & CLOSE
                </button>
              </div>
            </div>
          )}

          {/* View Routing based on active nav tab or sidebar view */}
          {activeNavTab === 'arena' ? (
            status === 'found' && roomData ? (
              <BattleArena 
                roomId={roomData.room_id} 
                clientId={clientId} 
                puzzleData={roomData.puzzle} 
                isPracticeMode={roomData.players && roomData.players.length === 1} 
                createdAt={roomData.created_at} 
              />
            ) : (
              <div className="glass-panel" style={{ padding: '3rem', margin: 'auto', maxWidth: '600px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
                <div style={{ fontSize: '3rem', color: 'var(--accent-pink)' }}>📡</div>
                <h2 style={{ color: '#fff', letterSpacing: '0.15em', margin: 0 }}>NO ACTIVE COMBAT SEQUENCE</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6', margin: 0 }}>
                  You are currently in standby mode. Select a protocol complexity in Mission Control to initiate a live multiplayer duel or launch training mode against the CyberBot.
                </p>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button className="action-submit-btn" onClick={() => { setActiveNavTab('lobby'); setSidebarView('battles'); findMatch(difficulty); }}>
                    INITIATE DUEL
                  </button>
                  <button className="new-duel-btn" style={{ marginTop: 0, padding: '0.8rem 1.5rem' }} onClick={() => { startPractice(difficulty); }}>
                    LAUNCH TRAINING
                  </button>
                </div>
              </div>
            )
          ) : sidebarView === 'friends' ? (
            <div className="mission-control-container">
              <div className="banner-card glass-panel">
                <div className="banner-text">
                  <h2>OPERATIVE_NETWORK</h2>
                  <p>ACTIVE SYNC WITH NEURAL OPERATIVES IN YOUR NETWORK SQUAD.</p>
                </div>
              </div>

              {/* Form to Search & Send Squad Request */}
              <form onSubmit={handleAddFriend} className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', textAlign: 'left' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', letterSpacing: '0.1em' }}>SEARCH OPERATIVE DATABASE BY CLIENT_ID / CALLSIGN:</label>
                <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                  <input 
                    type="text"
                    placeholder="e.g. BYTE_KNIGHT or 813F8D2B..."
                    value={newFriendInput}
                    onChange={(e) => setNewFriendInput(e.target.value)}
                    style={{
                      flex: 1,
                      background: 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(0,243,255,0.3)',
                      color: '#fff',
                      padding: '0.6rem 1rem',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none'
                    }}
                  />
                  <button type="submit" className="action-submit-btn" style={{ padding: '0.6rem 1.5rem', fontSize: '0.8rem' }}>
                    SEND SQUAD REQUEST
                  </button>
                </div>
                {searchStatus && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                    {searchStatus}
                  </span>
                )}
              </form>

              <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {friendsList.length === 0 ? (
                  <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>NO SQUAD MEMBERS ADDED YET. USE THE SEARCH BAR ABOVE TO SEND SQUAD REQUESTS.</div>
                ) : (
                  friendsList.map((friend, idx) => (
                    <div key={idx} className="leaderboard-item" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ color: friend.online ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                          {friend.online ? '●' : '○'}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                          <span style={{ fontWeight: 'bold' }}>{friend.name}</span>
                          <span style={{ fontSize: '0.7rem', color: friend.pending ? 'var(--accent-pink)' : 'var(--accent-cyan)' }}>{friend.status}</span>
                        </div>
                      </div>
                      
                      {friend.pending ? (
                        friend.incoming ? (
                          <button 
                            className="new-duel-btn" 
                            style={{ marginTop: 0, padding: '0.4rem 0.8rem', fontSize: '0.7rem' }}
                            onClick={() => handleAcceptFriend(friend.name)}
                          >
                            ACCEPT REQUEST
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-pink)', fontFamily: 'var(--font-mono)' }}>PENDING</span>
                        )
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-green)' }}>SYNCED</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : sidebarView === 'history' ? (
            <div className="mission-control-container">
              <div className="banner-card glass-panel">
                <div className="banner-text">
                  <h2>COMBAT_HISTORY_LOG</h2>
                  <p>RECORD OF PAST ENGAGEMENTS AND TELEMETRY ASSERTS.</p>
                </div>
              </div>
              <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {playerWins === 0 ? (
                  <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>NO MATCHES RECORDED YET. INITIATE A DUEL OR TRAINING SESSION TO LOG COMBAT HISTORY.</div>
                ) : (
                  <div className="leaderboard-item" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-green)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '0.2rem' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--accent-green)' }}>VICTORY (RECENT COMBAT)</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>MISSION: ALGORITHMIC_DUEL // TIME: EVALUATED</span>
                    </div>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>+{playerXP} XP</span>
                  </div>
                )}
              </div>
            </div>
          ) : sidebarView === 'stats' ? (
            <div className="mission-control-container">
              <div className="banner-card glass-panel">
                <div className="banner-text">
                  <h2>OPERATOR_DIAGNOSTICS</h2>
                  <p>PERFORMANCE ANALYTICS AND CODE VELOCITY METRICS.</p>
                </div>
              </div>
              <div className="lobby-grid">
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
                  <h3 style={{ color: 'var(--accent-cyan)' }}>COMPETITIVE PERFORMANCE</h3>
                  <div className="stat-row">
                    <div className="stat-box" style={{ padding: '1rem' }}>
                      <div className="stat-val" style={{ color: 'var(--accent-green)', fontSize: '1.8rem' }}>{playerWins}</div>
                      <div className="stat-lbl">TOTAL WINS</div>
                    </div>
                    <div className="stat-box" style={{ padding: '1rem' }}>
                      <div className="stat-val" style={{ color: 'var(--accent-cyan)', fontSize: '1.8rem' }}>{winRatio}%</div>
                      <div className="stat-lbl">WIN RATIO</div>
                    </div>
                  </div>
                  <div className="stat-row">
                    <div className="stat-box" style={{ padding: '1rem' }}>
                      <div className="stat-val" style={{ color: 'var(--accent-pink)', fontSize: '1.8rem' }}>{playerWins > 0 ? '450 CPM' : '0 CPM'}</div>
                      <div className="stat-lbl">TYPING VELOCITY</div>
                    </div>
                    <div className="stat-box" style={{ padding: '1rem' }}>
                      <div className="stat-val" style={{ color: 'var(--accent-orange)', fontSize: '1.8rem' }}>{playerWinstreak}</div>
                      <div className="stat-lbl">BEST WINSTREAK</div>
                    </div>
                  </div>
                </div>
                
                <div className="telemetry-widget">
                  <div className="widget-title">
                    <span>RANK_PROGRESSION</span>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>{rankTitle}</div>
                  <div className="complexity-bar" style={{ height: '8px', marginBottom: '1rem' }}>
                    <div className="complexity-fill" style={{ width: `${Math.min(100, (playerXP / 10000) * 100)}%` }}></div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>TOTAL EXPERIENCE: {playerXP.toLocaleString()} XP (LEVEL {level})</span>
                </div>
              </div>
            </div>
          ) : (
            /* Main Mission Control Lobby View */
            <div className="mission-control-container">
              {/* Banner Control Header */}
              <div className="banner-card glass-panel">
                <div className="banner-text">
                  <h2>MISSION_CONTROL</h2>
                  <p>
                    {status === 'searching' 
                      ? 'LOCATING OPTIMAL NODES FOR ENGAGEMENT...' 
                      : status === 'connecting' 
                        ? 'ESTABLISHING UPLINK TO COMBAT SERVER...' 
                        : status === 'error' 
                          ? 'SYSTEM ERROR: COMBAT UPLINK SEVERED' 
                          : 'SELECT PROTOCOL COMPLEXITY AND INITIATE COMBAT.'}
                  </p>
                </div>

                {status === 'searching' && (
                  <div className="telemetry-chip" style={{ background: 'rgba(255, 0, 127, 0.1)', borderColor: 'var(--accent-pink)', color: 'var(--accent-pink)' }}>
                    <span>📡</span> SCANNING FREQUENCIES...
                  </div>
                )}
              </div>

              {/* Main Content Grid: Protocol Selector vs Telemetry */}
              <div className="lobby-grid">
                {/* Protocols / Difficulty Cards Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div className="protocol-cards-row">
                    {/* Easy Protocol Card */}
                    <div 
                      className={`protocol-card ${difficulty === 'easy' ? 'selected' : ''}`}
                      onClick={() => setDifficulty('easy')}
                    >
                      <span className="protocol-badge">LVL: 01-10</span>
                      <div className="protocol-icon">
                        <span className="protocol-icon-inner">💻</span>
                      </div>
                      <h3 className="protocol-title">EASY_PROTOCOL</h3>
                      <div className="complexity-bar">
                        <div className="complexity-fill" style={{ width: '30%' }}></div>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>COMPLEXITY: 1.2x</span>
                      <button className="select-protocol-btn">
                        {difficulty === 'easy' ? 'SELECTED' : 'SELECT'}
                      </button>
                    </div>

                    {/* Intermediate Node Card */}
                    <div 
                      className={`protocol-card ${difficulty === 'intermediate' ? 'selected' : ''}`}
                      onClick={() => setDifficulty('intermediate')}
                    >
                      <span className="protocol-badge">LVL: 11-30</span>
                      <div className="protocol-icon">
                        <span className="protocol-icon-inner">⚡</span>
                      </div>
                      <h3 className="protocol-title">INTERMEDIATE_NODE</h3>
                      <div className="complexity-bar">
                        <div className="complexity-fill" style={{ width: '65%' }}></div>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>COMPLEXITY: 2.8x</span>
                      <button className="select-protocol-btn">
                        {difficulty === 'intermediate' ? 'SELECTED' : 'SELECT'}
                      </button>
                    </div>

                    {/* Hard Encryption Card */}
                    <div 
                      className={`protocol-card ${difficulty === 'difficult' ? 'selected' : ''}`}
                      onClick={() => setDifficulty('difficult')}
                    >
                      <span className="protocol-badge">LVL: 31-50</span>
                      <div className="protocol-icon">
                        <span className="protocol-icon-inner">🛡️</span>
                      </div>
                      <h3 className="protocol-title">HARD_ENCRYPTION</h3>
                      <div className="complexity-bar">
                        <div className="complexity-fill" style={{ width: '100%', background: 'var(--accent-pink)' }}></div>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>COMPLEXITY: 5.0x</span>
                      <button className="select-protocol-btn">
                        {difficulty === 'difficult' ? 'SELECTED' : 'SELECT'}
                      </button>
                    </div>
                  </div>

                  {/* Game Execution Action Buttons */}
                  <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', gap: '1.5rem', justifyContent: 'center', alignItems: 'center' }}>
                    {status === 'idle' && (
                      <>
                        <button className="action-submit-btn" onClick={() => findMatch(difficulty)}>
                          INITIATE DUEL
                        </button>
                        <button className="new-duel-btn" style={{ marginTop: 0, width: 'auto', padding: '0.8rem 1.8rem' }} onClick={() => startPractice(difficulty)}>
                          TRAINING MODE
                        </button>
                      </>
                    )}

                    {status === 'searching' && (
                      <button className="action-submit-btn" style={{ background: 'var(--accent-pink)', boxShadow: '0 0 20px var(--accent-pink)' }} onClick={cancelMatch}>
                        ABORT SEARCH
                      </button>
                    )}

                    {status === 'connecting' && (
                      <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-heading)' }}>LINKING TO SERVER...</span>
                    )}

                    {status === 'error' && (
                      <button className="action-submit-btn" style={{ background: 'var(--accent-red)' }} onClick={() => findMatch(difficulty)}>
                        RETRY UPLINK
                      </button>
                    )}
                  </div>
                </div>

                {/* Side Telemetry Column */}
                <div className="side-telemetry-column">
                  {/* Operator Stats Widget */}
                  <div className="telemetry-widget" style={{ cursor: 'pointer' }} onClick={() => setSidebarView('stats')}>
                    <div className="widget-title">
                      <span>{operatorName}</span>
                      <span style={{ color: 'var(--accent-cyan)' }}>LVL {level}</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', textAlign: 'left' }}>
                      EXPERIENCE {playerXP.toLocaleString()} / 10,000 XP
                    </div>
                    <div className="complexity-bar" style={{ height: '6px' }}>
                      <div className="complexity-fill" style={{ width: `${Math.min(100, (playerXP / 10000) * 100)}%` }}></div>
                    </div>
                    <div className="stat-row">
                      <div className="stat-box">
                        <div className="stat-val" style={{ color: 'var(--accent-cyan)' }}>{winRatio}%</div>
                        <div className="stat-lbl">WIN RATIO</div>
                      </div>
                      <div className="stat-box">
                        <div className="stat-val" style={{ color: 'var(--accent-pink)' }}>{playerWinstreak}</div>
                        <div className="stat-lbl">WINSTREAK</div>
                      </div>
                    </div>
                  </div>

                  {/* Leaderboard Widget */}
                  <div className="telemetry-widget">
                    <div className="widget-title">
                      <span>SEASON_TOP_5</span>
                      <span>🏆</span>
                    </div>
                    <div className="leaderboard-list">
                      {leaderboardData.length === 0 ? (
                        <div style={{ padding: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                          NO LEADERBOARD RECORDED YET. INITIATE COMBAT PROTOCOLS TO CLAIM THE TOP SPOT!
                        </div>
                      ) : (
                        leaderboardData.map((user, idx) => (
                          <div key={user.id} className={`leaderboard-item ${user.username.toUpperCase() === operatorName.toUpperCase() ? 'me' : ''}`}>
                            <span>{`0${idx + 1} ${user.username.toUpperCase()}`}</span>
                            <span style={{ color: 'var(--accent-cyan)' }}>{user.xp.toLocaleString()}</span>
                          </div>
                        ))
                      )}
                      {isLoggedIn && !leaderboardData.some(user => user.username.toUpperCase() === operatorName.toUpperCase()) && (
                        <div className="leaderboard-item me">
                          <span>-- {operatorName.toUpperCase()}</span>
                          <span style={{ color: 'var(--accent-cyan)' }}>{playerXP.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer style={{ padding: '0.5rem 1rem', background: 'rgba(5, 7, 10, 0.95)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
        <span>© 2026 CODE BATTLE ROYALE. ALL SYSTEMS OPERATIONAL.</span>
        <div>
          <span style={{ marginRight: '1rem', cursor: 'pointer' }} onClick={() => setIsSettingsOpen(true)}>TERMINOLOGY</span>
          <span style={{ marginRight: '1rem', cursor: 'pointer' }} onClick={() => setIsSettingsOpen(true)}>PROTOCOL</span>
          <span style={{ cursor: 'pointer' }} onClick={() => setIsSettingsOpen(true)}>SECURITY</span>
        </div>
        <span style={{ color: 'var(--accent-green)' }}>● SERVER_STATUS: ONLINE</span>
      </footer>
    </div>
  );
}

export default App;
