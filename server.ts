import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

interface PlayerSession {
  ws: WebSocket;
  id: string;
  name: string;
  teamId?: string;
  isReady: boolean;
}

interface Room {
  code: string;
  gameMode: 'competitive' | 'cooperative';
  overs: number;
  difficulty: 'easy' | 'medium' | 'hard';
  host: PlayerSession;
  guest?: PlayerSession;
  status: 'lobby' | 'playing' | 'innings_break' | 'finished';
  currentTurn: 'host' | 'guest'; // who is batting
  seed: number;
}

interface LeaderboardEntry {
  name: string;
  wins: number;
  runs: number;
  wickets: number;
  matches: number;
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const PORT = 3000;

app.use(express.json());

// Persistent Leaderboard Setup
const LEADERBOARD_FILE = path.join(process.cwd(), 'leaderboard.json');
let leaderboard: LeaderboardEntry[] = [];

function loadLeaderboard() {
  try {
    if (fs.existsSync(LEADERBOARD_FILE)) {
      const data = fs.readFileSync(LEADERBOARD_FILE, 'utf8');
      leaderboard = JSON.parse(data);
    } else {
      leaderboard = [
        { name: 'Sachin_Legend', wins: 45, runs: 1250, wickets: 24, matches: 50 },
        { name: 'KingKohli_Star', wins: 42, runs: 1340, wickets: 12, matches: 48 },
        { name: 'Shane_Spin', wins: 38, runs: 320, wickets: 88, matches: 45 },
        { name: 'Bumrah_Yorker', wins: 35, runs: 150, wickets: 94, matches: 42 },
        { name: 'Gilchrist_Keeper', wins: 30, runs: 980, wickets: 5, matches: 38 }
      ];
      saveLeaderboard();
    }
  } catch (error) {
    console.error('Failed to load leaderboard:', error);
  }
}

function saveLeaderboard() {
  try {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save leaderboard:', error);
  }
}

loadLeaderboard();

// Leaderboard API endpoint
app.get('/api/leaderboard', (req, res) => {
  res.json(leaderboard.sort((a, b) => b.wins - a.wins || b.runs - a.runs));
});

app.post('/api/leaderboard/submit', (req, res) => {
  const { name, wins, runs, wickets, matches } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Name is required' });
  }

  const existing = leaderboard.find(e => e.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.wins += wins || 0;
    existing.runs += runs || 0;
    existing.wickets += wickets || 0;
    existing.matches += matches || 0;
  } else {
    leaderboard.push({
      name,
      wins: wins || 0,
      runs: runs || 0,
      wickets: wickets || 0,
      matches: matches || 0
    });
  }
  saveLeaderboard();
  res.json({ success: true, leaderboard: leaderboard.sort((a, b) => b.wins - a.wins) });
});

// Real-time Multiplayer Management
const rooms = new Map<string, Room>();
let matchmakingQueue: PlayerSession[] = [];

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// Coordinate WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

wss.on('connection', (ws: WebSocket) => {
  let playerSession: PlayerSession | null = null;
  let currentRoomCode: string | null = null;

  const send = (type: string, payload: any) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...payload }));
    }
  };

  const broadcastToRoom = (roomCode: string, type: string, payload: any, skipSelf = false) => {
    const r = rooms.get(roomCode);
    if (!r) return;
    const clients = [r.host, r.guest].filter((p): p is PlayerSession => !!p);
    clients.forEach(c => {
      if (skipSelf && playerSession && c.id === playerSession.id) return;
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(JSON.stringify({ type, ...payload }));
      }
    });
  };

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'init': {
          playerSession = {
            ws,
            id: data.playerId || `p_${Math.random().toString(36).substr(2, 9)}`,
            name: data.playerName || 'Guest Cricketer',
            isReady: false
          };
          send('init_ok', { playerId: playerSession.id });
          break;
        }

        case 'create_room': {
          if (!playerSession) return;
          const code = generateRoomCode();
          playerSession.teamId = data.teamId;
          const newRoom: Room = {
            code,
            gameMode: data.gameMode || 'competitive',
            overs: data.overs || 2,
            difficulty: data.difficulty || 'medium',
            host: playerSession,
            status: 'lobby',
            currentTurn: 'host',
            seed: Math.floor(Math.random() * 100000)
          };
          rooms.set(code, newRoom);
          currentRoomCode = code;
          send('room_created', {
            code,
            gameMode: newRoom.gameMode,
            overs: newRoom.overs,
            difficulty: newRoom.difficulty,
            role: 'host'
          });
          break;
        }

        case 'join_room': {
          if (!playerSession) return;
          const code = data.code?.toUpperCase();
          const r = rooms.get(code);
          if (!r) {
            send('error', { message: 'Room not found' });
            return;
          }
          if (r.guest) {
            send('error', { message: 'Room is full' });
            return;
          }
          playerSession.teamId = data.teamId;
          r.guest = playerSession;
          currentRoomCode = code;

          send('room_joined', {
            code,
            gameMode: r.gameMode,
            overs: r.overs,
            difficulty: r.difficulty,
            role: 'guest',
            hostName: r.host.name,
            hostTeamId: r.host.teamId
          });

          broadcastToRoom(code, 'player_joined', {
            guestName: playerSession.name,
            guestTeamId: playerSession.teamId
          }, true);
          break;
        }

        case 'quick_match': {
          if (!playerSession) return;
          playerSession.teamId = data.teamId;
          
          // Remove from previous matchings if any
          matchmakingQueue = matchmakingQueue.filter(p => p.id !== playerSession!.id);
          
          if (matchmakingQueue.length > 0) {
            const opponent = matchmakingQueue.shift()!;
            const code = generateRoomCode();
            
            const newRoom: Room = {
              code,
              gameMode: 'competitive',
              overs: 2,
              difficulty: 'medium',
              host: opponent,
              guest: playerSession,
              status: 'lobby',
              currentTurn: 'host',
              seed: Math.floor(Math.random() * 100000)
            };
            
            rooms.set(code, newRoom);
            currentRoomCode = code;
            opponent.ws.send(JSON.stringify({
              type: 'match_found',
              code,
              role: 'host',
              opponentName: playerSession.name,
              opponentTeamId: playerSession.teamId,
              overs: 2,
              difficulty: 'medium'
            }));

            send('match_found', {
              code,
              role: 'guest',
              opponentName: opponent.name,
              opponentTeamId: opponent.teamId,
              overs: 2,
              difficulty: 'medium'
            });
          } else {
            matchmakingQueue.push(playerSession);
            send('matchmaking_waiting', { message: 'Searching for online opponents...' });
          }
          break;
        }

        case 'cancel_quick_match': {
          if (!playerSession) return;
          matchmakingQueue = matchmakingQueue.filter(p => p.id !== playerSession!.id);
          send('matchmaking_cancelled', {});
          break;
        }

        case 'player_ready': {
          if (!playerSession || !currentRoomCode) return;
          const r = rooms.get(currentRoomCode);
          if (!r) return;

          if (r.host.id === playerSession.id) {
            r.host.isReady = data.ready;
          } else if (r.guest && r.guest.id === playerSession.id) {
            r.guest.isReady = data.ready;
          }

          broadcastToRoom(currentRoomCode, 'ready_status', {
            hostReady: r.host.isReady,
            guestReady: r.guest ? r.guest.isReady : false
          });

          // Auto-start game if both are ready
          if (r.host.isReady && r.guest && r.guest.isReady) {
            r.status = 'playing';
            broadcastToRoom(currentRoomCode, 'game_start', {
              seed: r.seed,
              hostTeamId: r.host.teamId,
              guestTeamId: r.guest.teamId,
              overs: r.overs,
              difficulty: r.difficulty
            });
          }
          break;
        }

        case 'bowler_pitch': {
          // Bowler shares where and what ball is delivered
          if (!currentRoomCode) return;
          broadcastToRoom(currentRoomCode, 'opponent_delivered', {
            deliveryType: data.deliveryType,
            pitchX: data.pitchX,
            pitchY: data.pitchY,
            releasePower: data.releasePower
          }, true);
          break;
        }

        case 'batsman_swing': {
          // Batsman shares timing and swing angle
          if (!currentRoomCode) return;
          broadcastToRoom(currentRoomCode, 'opponent_swung', {
            timingDiff: data.timingDiff, // negative/positive ms
            shotAngle: data.shotAngle,
            shotPower: data.shotPower,
            lofted: data.lofted
          }, true);
          break;
        }

        case 'sync_ball_result': {
          // Authoritatively synchronizes delivery result (runs scored, wickets etc.)
          if (!currentRoomCode) return;
          broadcastToRoom(currentRoomCode, 'ball_result_synced', {
            runs: data.runs,
            isWicket: data.isWicket,
            outReason: data.outReason,
            speed: data.speed,
            distance: data.distance
          }, true);
          break;
        }

        case 'chat': {
          if (!playerSession || !currentRoomCode) return;
          broadcastToRoom(currentRoomCode, 'chat_received', {
            sender: playerSession.name,
            message: data.message
          });
          break;
        }

        case 'sync_scorecard': {
          if (!currentRoomCode) return;
          broadcastToRoom(currentRoomCode, 'scorecard_synced', {
            runs: data.runs,
            wickets: data.wickets,
            balls: data.balls,
            target: data.target,
            isInnings1Active: data.isInnings1Active
          }, true);
          break;
        }

        case 'rematch_request': {
          if (!currentRoomCode) return;
          broadcastToRoom(currentRoomCode, 'opponent_requested_rematch', {}, true);
          break;
        }

        case 'rematch_accept': {
          if (!currentRoomCode) return;
          const r = rooms.get(currentRoomCode);
          if (r) {
            r.status = 'playing';
            r.seed = Math.floor(Math.random() * 100000);
            broadcastToRoom(currentRoomCode, 'game_start', {
              seed: r.seed,
              hostTeamId: r.host.teamId,
              guestTeamId: r.guest ? r.guest.teamId : undefined,
              overs: r.overs,
              difficulty: r.difficulty
            });
          }
          break;
        }
      }
    } catch (e) {
      console.error('Error handling WS message:', e);
    }
  });

  ws.on('close', () => {
    if (playerSession) {
      // Remove from matchmaking queue
      matchmakingQueue = matchmakingQueue.filter(p => p.id !== playerSession!.id);
      
      // Notify and clean room
      if (currentRoomCode) {
        const r = rooms.get(currentRoomCode);
        if (r) {
          broadcastToRoom(currentRoomCode, 'opponent_left', {
            message: `${playerSession.name} disconnected.`
          }, true);
          rooms.delete(currentRoomCode);
        }
      }
    }
  });
});

// Vite Integration Setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Full Stack Cricket 24 Server running on port ${PORT}`);
  });
}

startServer();
