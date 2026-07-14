import React, { useState, useEffect } from 'react';
import { Team, MultiplayerState } from '../types';
import { TEAMS } from '../lib/teamsData';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, ShieldAlert, Trophy, Play, CheckCircle2, 
  MessageSquare, Send, Globe, Search, Plus, UserPlus, Eye 
} from 'lucide-react';
import { audioEngine } from '../lib/audio';

interface LeaderboardEntry {
  name: string;
  wins: number;
  runs: number;
  wickets: number;
  matches: number;
}

interface MultiplayerLobbyProps {
  onBackToMenu: () => void;
  onStartMultiplayerGame: (
    socket: WebSocket,
    roomCode: string,
    role: 'host' | 'guest',
    gameMode: 'competitive' | 'cooperative',
    userTeam: Team,
    opponentTeam: Team,
    overs: number,
    difficulty: 'easy' | 'medium' | 'hard'
  ) => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({ onBackToMenu, onStartMultiplayerGame }) => {
  const [activeTab, setActiveTab] = useState<'lobby' | 'leaderboard'>('lobby');
  const [roleMode, setRoleMode] = useState<'host' | 'join'>('host');
  
  // Input fields
  const [playerName, setPlayerName] = useState(() => {
    // try reading career name, or fallback
    const savedCareer = localStorage.getItem('cricket_c24_career');
    if (savedCareer) {
      try {
        return JSON.parse(savedCareer).customCricketer.name;
      } catch (e) {}
    }
    return '';
  });
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('ind');
  const [gameMode, setGameMode] = useState<'competitive' | 'cooperative'>('competitive');
  const [overs, setOvers] = useState<number>(2);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // WebSocket / Multiplayer connection state
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [lobbyState, setLobbyState] = useState<MultiplayerState>({
    roomCode: null,
    role: null,
    gameMode: 'competitive',
    opponentName: null,
    opponentTeamId: null,
    hostReady: false,
    guestReady: false,
    status: 'idle',
    isConnected: false,
    chatMessages: []
  });

  // Matchmaking Queue
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [matchmakingText, setMatchmakingText] = useState('Searching for online players...');

  // Leaderboard data
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Chat message input
  const [chatInput, setChatInput] = useState('');

  // Fetch leaderboard on tab change
  useEffect(() => {
    if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    }
  }, [activeTab]);

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setLeaderboard(data);
      }
    } catch (e) {
      console.warn('Failed to load leaderboard:', e);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // Close socket on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [socket]);

  const connectWebSocket = (onConnect: (ws: WebSocket) => void) => {
    if (!playerName.trim()) {
      alert('Please enter your cricketer display name first.');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'init',
        playerName: playerName.trim()
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'init_ok': {
          setLobbyState(prev => ({ ...prev, isConnected: true }));
          onConnect(ws);
          break;
        }

        case 'room_created': {
          setLobbyState(prev => ({
            ...prev,
            roomCode: data.code,
            role: 'host',
            gameMode: data.gameMode,
            status: 'lobby'
          }));
          break;
        }

        case 'room_joined': {
          setLobbyState(prev => ({
            ...prev,
            roomCode: data.code,
            role: 'guest',
            gameMode: data.gameMode,
            opponentName: data.hostName,
            opponentTeamId: data.hostTeamId,
            status: 'lobby'
          }));
          break;
        }

        case 'player_joined': {
          setLobbyState(prev => ({
            ...prev,
            opponentName: data.guestName,
            opponentTeamId: data.guestTeamId
          }));
          audioEngine.playBoundaryCheer();
          break;
        }

        case 'match_found': {
          setIsMatchmaking(false);
          const oppTeam = TEAMS.find(t => t.id === data.opponentTeamId) || TEAMS[1];
          const userTeam = TEAMS.find(t => t.id === selectedTeamId) || TEAMS[0];
          
          setLobbyState(prev => ({
            ...prev,
            roomCode: data.code,
            role: data.role,
            opponentName: data.opponentName,
            opponentTeamId: data.opponentTeamId,
            status: 'playing'
          }));

          onStartMultiplayerGame(
            ws,
            data.code,
            data.role,
            'competitive',
            userTeam,
            oppTeam,
            data.overs,
            data.difficulty
          );
          break;
        }

        case 'ready_status': {
          setLobbyState(prev => ({
            ...prev,
            hostReady: data.hostReady,
            guestReady: data.guestReady
          }));
          break;
        }

        case 'game_start': {
          setLobbyState(prev => ({ ...prev, status: 'playing' }));
          
          const oppTeam = TEAMS.find(t => t.id === lobbyState.opponentTeamId) || TEAMS[1];
          const userTeam = TEAMS.find(t => t.id === selectedTeamId) || TEAMS[0];

          onStartMultiplayerGame(
            ws,
            lobbyState.roomCode!,
            lobbyState.role!,
            lobbyState.gameMode,
            userTeam,
            oppTeam,
            overs,
            difficulty
          );
          break;
        }

        case 'chat_received': {
          setLobbyState(prev => ({
            ...prev,
            chatMessages: [...prev.chatMessages, {
              sender: data.sender,
              message: data.message,
              timestamp: new Date()
            }]
          }));
          break;
        }

        case 'opponent_left': {
          alert('Your opponent disconnected from the match.');
          resetLobby();
          break;
        }

        case 'error': {
          alert(data.message);
          ws.close();
          break;
        }
      }
    };

    ws.onclose = () => {
      setLobbyState(prev => ({ ...prev, isConnected: false }));
    };

    setSocket(ws);
  };

  const handleCreateRoom = () => {
    connectWebSocket((ws) => {
      ws.send(JSON.stringify({
        type: 'create_room',
        teamId: selectedTeamId,
        gameMode,
        overs,
        difficulty
      }));
    });
  };

  const handleJoinRoom = () => {
    if (!roomCodeInput.trim()) {
      alert('Please enter a valid 6-character room code.');
      return;
    }
    connectWebSocket((ws) => {
      ws.send(JSON.stringify({
        type: 'join_room',
        code: roomCodeInput.trim().toUpperCase(),
        teamId: selectedTeamId
      }));
    });
  };

  const handleQuickMatch = () => {
    setIsMatchmaking(true);
    setMatchmakingText('Connecting to matchmaking servers...');
    connectWebSocket((ws) => {
      setMatchmakingText('Searching for competitive online rivals...');
      ws.send(JSON.stringify({
        type: 'quick_match',
        teamId: selectedTeamId
      }));
    });
  };

  const handleCancelMatchmaking = () => {
    setIsMatchmaking(false);
    if (socket) {
      socket.send(JSON.stringify({ type: 'cancel_quick_match' }));
      socket.close();
    }
    setSocket(null);
  };

  const handleToggleReady = () => {
    if (!socket || !lobbyState.roomCode) return;
    const isCurrentlyReady = lobbyState.role === 'host' ? lobbyState.hostReady : lobbyState.guestReady;
    socket.send(JSON.stringify({
      type: 'player_ready',
      ready: !isCurrentlyReady
    }));
  };

  const sendChatMessage = () => {
    if (!socket || !chatInput.trim()) return;
    socket.send(JSON.stringify({
      type: 'chat',
      message: chatInput.trim()
    }));
    setChatInput('');
  };

  const resetLobby = () => {
    if (socket) {
      socket.close();
    }
    setSocket(null);
    setLobbyState({
      roomCode: null,
      role: null,
      gameMode: 'competitive',
      opponentName: null,
      opponentTeamId: null,
      hostReady: false,
      guestReady: false,
      status: 'idle',
      isConnected: false,
      chatMessages: []
    });
  };

  return (
    <div className="w-full flex flex-col gap-6 font-sans text-white p-2" id="multiplayer-lobby">
      
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#38bdf8] to-[#22c55e] flex items-center justify-center text-black font-black">
            <Users size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">MULTIPLAYER <span className="text-[#38bdf8] text-glow-sky">ONLINE ARENA</span></h1>
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Host, join, matchmake, and fight for the top of the global leaderboards</p>
          </div>
        </div>
        
        {/* Navigation tabs */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('lobby')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'lobby' ? 'bg-[#38bdf8] text-black font-extrabold' : 'bg-white/5 border border-white/15'
            }`}
          >
            Lobby
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${
              activeTab === 'leaderboard' ? 'bg-[#38bdf8] text-black font-extrabold' : 'bg-white/5 border border-white/15'
            }`}
          >
            Leaderboard
          </button>
          <button
            onClick={onBackToMenu}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-black uppercase tracking-wider transition"
          >
            Back
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'leaderboard' ? (
          /* Leaderboards view */
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-[10px] font-black text-brand-sky tracking-widest uppercase flex items-center gap-1">
                <Trophy size={12} /> GLOBAL ON-SITE CHAMPIONS LEADERBOARD
              </span>
              <button 
                onClick={fetchLeaderboard}
                className="text-[10px] font-black hover:underline uppercase text-brand-emerald"
              >
                Refresh Board
              </button>
            </div>

            {loadingLeaderboard ? (
              <div className="text-center py-10 text-xs font-bold text-neutral-400">
                Contacting global database...
              </div>
            ) : (
              <div className="w-full overflow-hidden border border-white/5 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-black/40 text-[9px] uppercase font-black text-neutral-400 border-b border-white/10">
                      <th className="p-3">Rank</th>
                      <th className="p-3">Cricketer</th>
                      <th className="p-3 text-center">Matches</th>
                      <th className="p-3 text-center text-brand-emerald">Wins</th>
                      <th className="p-3 text-center">Runs</th>
                      <th className="p-3 text-center text-brand-sky">Wickets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((player, idx) => (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="p-3 flex items-center gap-2">
                          <span className={`font-mono font-black px-2 py-0.5 rounded ${
                            idx === 0 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                            idx === 1 ? 'bg-neutral-300/10 text-neutral-300 border border-neutral-300/20' :
                            'text-neutral-500'
                          }`}>
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-neutral-100">{player.name}</td>
                        <td className="p-3 text-center font-mono">{player.matches}</td>
                        <td className="p-3 text-center font-mono text-brand-emerald font-black">{player.wins}</td>
                        <td className="p-3 text-center font-mono">{player.runs}</td>
                        <td className="p-3 text-center font-mono text-brand-sky font-black">{player.wickets}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        ) : (
          /* Main lobby interface */
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {lobbyState.status === 'idle' ? (
              /* Idle Setup Form */
              <>
                {/* Left: Quick Actions & Custom Profile */}
                <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-2xl flex flex-col gap-4">
                  <span className="text-[10px] font-black text-[#38bdf8] tracking-widest uppercase block border-b border-white/10 pb-2">
                    1. IDENTIFICATION
                  </span>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-black tracking-wide text-neutral-400">Display Player Name</label>
                    <input 
                      type="text" 
                      value={playerName} 
                      onChange={(e) => setPlayerName(e.target.value)}
                      placeholder="e.g. MS_Dhoni" 
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm font-black text-white focus:outline-none focus:border-[#38bdf8]"
                    />
                  </div>

                  <div className="bg-black/40 p-4 border border-white/5 rounded-xl mt-2">
                    <span className="text-[10px] font-black text-neutral-400 uppercase block mb-2">My Franchise Squad</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {TEAMS.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTeamId(t.id)}
                          className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 text-[10px] font-black uppercase transition ${
                            selectedTeamId === t.id 
                              ? 'bg-[#38bdf8] border-[#38bdf8] text-black' 
                              : 'bg-black/40 border-white/5 hover:border-white/15'
                          }`}
                        >
                          <span className="text-xl">{t.flagEmoji}</span>
                          <span>{t.shortName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Center & Right: Room Coordination modes */}
                <div className="lg:col-span-2 bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-2xl flex flex-col gap-6">
                  
                  {/* Matchmaking quick play */}
                  <div className="p-4 bg-gradient-to-r from-[#38bdf8]/10 to-transparent border border-[#38bdf8]/20 rounded-xl flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h3 className="text-sm font-black uppercase text-neutral-200">Competitive Ranked Quick Match</h3>
                      <p className="text-xs text-neutral-400 font-medium mt-0.5">Click to find a live player on the platform and battle in real-time</p>
                    </div>
                    {isMatchmaking ? (
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-bold text-neutral-400 animate-pulse">{matchmakingText}</span>
                        <button
                          onClick={handleCancelMatchmaking}
                          className="px-3 py-1.5 border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs font-black uppercase tracking-wider rounded-lg transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleQuickMatch}
                        className="px-5 py-2.5 bg-gradient-to-r from-[#38bdf8] to-[#22c55e] hover:opacity-95 text-black font-black text-xs uppercase tracking-widest rounded-xl shadow-[0_0_12px_rgba(56,189,248,0.25)] flex items-center gap-1.5 transition"
                      >
                        <Search size={13} /> Find Match
                      </button>
                    )}
                  </div>

                  {/* Manual hosting / joining tabs */}
                  <div className="flex border-b border-white/10 pb-1">
                    <button
                      onClick={() => setRoleMode('host')}
                      className={`px-4 py-2 text-xs font-black uppercase border-b-2 transition ${
                        roleMode === 'host' ? 'border-[#38bdf8] text-[#38bdf8]' : 'border-transparent text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Host Custom Arena
                    </button>
                    <button
                      onClick={() => setRoleMode('join')}
                      className={`px-4 py-2 text-xs font-black uppercase border-b-2 transition ${
                        roleMode === 'join' ? 'border-[#38bdf8] text-[#38bdf8]' : 'border-transparent text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      Join Arena Code
                    </button>
                  </div>

                  {roleMode === 'host' ? (
                    /* Host Panel */
                    <div className="flex flex-col gap-4 animate-fadeIn">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] uppercase font-black tracking-wide text-neutral-400">Match Mode</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setGameMode('competitive')}
                              className={`py-2 rounded-lg border text-xs font-black uppercase transition ${
                                gameMode === 'competitive' ? 'bg-[#38bdf8]/10 border-[#38bdf8] text-[#38bdf8]' : 'bg-black/40 border-white/5'
                              }`}
                            >
                              1v1 Battle
                            </button>
                            <button
                              onClick={() => setGameMode('cooperative')}
                              className={`py-2 rounded-lg border text-xs font-black uppercase transition ${
                                gameMode === 'cooperative' ? 'bg-[#38bdf8]/10 border-[#38bdf8] text-[#38bdf8]' : 'bg-black/40 border-white/5'
                              }`}
                            >
                              Partnership Co-op
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] uppercase font-black tracking-wide text-neutral-400">Match Length (Overs)</label>
                          <select
                            value={overs}
                            onChange={(e) => setOvers(Number(e.target.value))}
                            className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-black focus:outline-none focus:border-[#38bdf8]"
                          >
                            <option value={1}>1 Over (Super Over)</option>
                            <option value={2}>2 Overs (Quick Blitz)</option>
                            <option value={5}>5 Overs (Standard T5)</option>
                          </select>
                        </div>
                      </div>

                      <button
                        onClick={handleCreateRoom}
                        className="w-full py-3.5 bg-[#38bdf8] hover:bg-[#38bdf8]/90 text-black font-black uppercase text-xs tracking-widest rounded-xl shadow-[0_0_15px_rgba(56,189,248,0.25)] flex items-center justify-center gap-1.5 transition"
                      >
                        <Plus size={14} /> Create Room & Generate Code
                      </button>
                    </div>
                  ) : (
                    /* Join Panel */
                    <div className="flex flex-col gap-4 animate-fadeIn">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-black tracking-wide text-neutral-400">Enter Room Code</label>
                        <input 
                          type="text" 
                          maxLength={6}
                          value={roomCodeInput} 
                          onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                          placeholder="e.g. XRT89A" 
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-lg font-mono font-black text-center tracking-widest text-white uppercase focus:outline-none focus:border-[#38bdf8]"
                        />
                      </div>

                      <button
                        onClick={handleJoinRoom}
                        className="w-full py-3.5 bg-[#22c55e] hover:bg-[#22c55e]/90 text-black font-black uppercase text-xs tracking-widest rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.25)] flex items-center justify-center gap-1.5 transition"
                      >
                        <UserPlus size={14} /> Connect & Join Arena
                      </button>
                    </div>
                  )}

                </div>
              </>
            ) : (
              /* Inside Room Lobby Screen */
              <div className="col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Lobby Match Coordination Details */}
                <div className="lg:col-span-2 bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-2xl flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div>
                      <span className="text-[10px] font-black text-[#38bdf8] tracking-widest uppercase block">ROOM LOBBY</span>
                      <h2 className="text-xl font-black uppercase text-neutral-100">{lobbyState.gameMode === 'competitive' ? '1v1 Competitive Arena' : 'Partnership Co-op Arena'}</h2>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-neutral-400 block uppercase">Room Code</span>
                      <span className="text-lg font-mono font-black text-glow-sky text-[#38bdf8] tracking-widest">{lobbyState.roomCode}</span>
                    </div>
                  </div>

                  {/* Players Matchups */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                    
                    {/* Player 1: Host */}
                    <div className="bg-black/40 border border-white/10 p-4 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">👑</span>
                        <div>
                          <span className="text-[9px] uppercase font-black text-neutral-500 block">Host Player</span>
                          <span className="text-sm font-black text-neutral-200">{lobbyState.role === 'host' ? playerName : lobbyState.opponentName || 'Hosting Cricketer'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {lobbyState.hostReady ? (
                          <span className="px-2 py-1 bg-brand-emerald/10 border border-brand-emerald/20 text-brand-emerald text-[9px] font-black uppercase rounded">Ready</span>
                        ) : (
                          <span className="px-2 py-1 bg-white/5 border border-white/10 text-neutral-400 text-[9px] font-black uppercase rounded">Waiting</span>
                        )}
                      </div>
                    </div>

                    {/* Player 2: Guest */}
                    <div className="bg-black/40 border border-white/10 p-4 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🏏</span>
                        <div>
                          <span className="text-[9px] uppercase font-black text-neutral-500 block">Challenger Player</span>
                          <span className="text-sm font-black text-neutral-200">{lobbyState.role === 'guest' ? playerName : lobbyState.opponentName || 'Waiting for opponent...'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {lobbyState.guestReady ? (
                          <span className="px-2 py-1 bg-brand-emerald/10 border border-brand-emerald/20 text-brand-emerald text-[9px] font-black uppercase rounded">Ready</span>
                        ) : (
                          <span className="px-2 py-1 bg-white/5 border border-white/10 text-neutral-400 text-[9px] font-black uppercase rounded">Waiting</span>
                        )}
                      </div>
                    </div>

                  </div>

                  {/* Action Controls */}
                  <div className="flex items-center gap-3 mt-auto">
                    <button
                      onClick={handleToggleReady}
                      className={`flex-1 py-3.5 rounded-xl font-black uppercase text-xs tracking-widest shadow-md transition ${
                        (lobbyState.role === 'host' ? lobbyState.hostReady : lobbyState.guestReady)
                          ? 'bg-neutral-800 text-neutral-400 border border-white/5 hover:bg-neutral-750'
                          : 'bg-[#22c55e] text-black shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                      }`}
                    >
                      {(lobbyState.role === 'host' ? lobbyState.hostReady : lobbyState.guestReady) ? 'Cancel Ready' : 'Set Ready to Play'}
                    </button>
                    <button
                      onClick={resetLobby}
                      className="px-6 py-3.5 border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl text-xs font-black uppercase tracking-widest transition"
                    >
                      Leave Room
                    </button>
                  </div>
                </div>

                {/* Right Column: Chat Box */}
                <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-2xl flex flex-col justify-between h-[380px]">
                  <div>
                    <span className="text-[10px] font-black text-white tracking-widest uppercase block border-b border-white/10 pb-2">
                      ARENA REAL-TIME SHOUTBOX
                    </span>
                    
                    {/* Chat Messages */}
                    <div className="flex flex-col gap-2.5 overflow-y-auto h-[250px] p-2 mt-2">
                      {lobbyState.chatMessages.map((msg, idx) => (
                        <div key={idx} className="text-xs">
                          <strong className="text-brand-sky uppercase font-black mr-1">{msg.sender}:</strong>
                          <span className="text-neutral-300 font-medium">{msg.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Message Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Send emoji or message..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') sendChatMessage();
                      }}
                      className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#38bdf8]"
                    />
                    <button
                      onClick={sendChatMessage}
                      className="p-2 bg-[#38bdf8] hover:opacity-95 text-black font-bold rounded-xl"
                    >
                      <Send size={12} fill="black" />
                    </button>
                  </div>
                </div>

              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
