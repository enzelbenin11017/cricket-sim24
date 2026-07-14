import React, { useState, useEffect } from 'react';
import { GamePhase, Team, Innings, Player, BallHistory } from './types';
import { TEAMS } from './lib/teamsData';
import { StadiumCanvas } from './components/StadiumCanvas';
import { BroadcastScoreboard } from './components/BroadcastScoreboard';
import { CommentaryBox } from './components/CommentaryBox';
import { TeamSelector } from './components/TeamSelector';
import { MatchSummary } from './components/MatchSummary';
import { CareerMode } from './components/CareerMode';
import { TournamentMode } from './components/TournamentMode';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, HelpCircle, Volume2, ShieldAlert, Zap, Compass, Star, Trophy as AwardIcon } from 'lucide-react';
import { audioEngine } from './lib/audio';

export default function App() {
  const [phase, setPhase] = useState<GamePhase>('menu');
  const [userTeam, setUserTeam] = useState<Team>(TEAMS[0]);
  const [opponentTeam, setOpponentTeam] = useState<Team>(TEAMS[1]);
  const [overs, setOvers] = useState<number>(2);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [userBatsFirst, setUserBatsFirst] = useState<boolean>(true);
  
  // Scoring Innings states
  const [innings1, setInnings1] = useState<Innings | null>(null);
  const [innings2, setInnings2] = useState<Innings | null>(null);
  const [isInnings1Active, setIsInnings1Active] = useState<boolean>(true);

  // Active match play indexes
  const [strikerIdx, setStrikerIdx] = useState<number>(0); // Index in batsman list of innings
  const [activeBatsmanIndex, setActiveBatsmanIndex] = useState<number>(0); // 0 = batsman1, 1 = batsman2 has strike
  const [nextBatsmanIndex, setNextBatsmanIndex] = useState<number>(2); // Next batsman on roster to enter on wicket
  const [bowlerRosterIdx, setBowlerRosterIdx] = useState<number>(9); // Bowler selected index in roster (e.g. 9 or 10)

  // Broadcast Commentary List
  const [commentaryList, setCommentaryList] = useState<string[]>([]);
  const [lastBallSpeed, setLastBallSpeed] = useState<number | undefined>(undefined);
  const [lastBallType, setLastBallType] = useState<string | undefined>(undefined);

  // Help guides modal
  const [showHelp, setShowHelp] = useState(false);

  // Multiplayer Integration States
  const [isMpActive, setIsMpActive] = useState(false);
  const [mpSocket, setMpSocket] = useState<WebSocket | null>(null);
  const [mpRole, setMpRole] = useState<'host' | 'guest' | null>(null);
  const [mpGameMode, setMpGameMode] = useState<'competitive' | 'cooperative'>('competitive');
  const [mpOpponentAction, setMpOpponentAction] = useState<any | null>(null);
  const [mpRoomCode, setMpRoomCode] = useState<string>('');

  // Tournament Campaign States
  const [isTournamentMatch, setIsTournamentMatch] = useState(false);
  const [onTournamentMatchComplete, setOnTournamentMatchComplete] = useState<((userWon: boolean, userScoreStr: string, opponentScoreStr: string) => void) | null>(null);

  // Career Match States
  const [isCareerMatch, setIsCareerMatch] = useState(false);
  const [onCareerMatchComplete, setOnCareerMatchComplete] = useState<((runs: number, wickets: number) => void) | null>(null);

  const startTossPhase = () => {
    setPhase('team_select');
    audioEngine.init();
    audioEngine.startAmbient();
  };

  const setupMatch = (
    uTeam: Team,
    oTeam: Team,
    matchOvers: number,
    diff: 'easy' | 'medium' | 'hard',
    uBatsFirst: boolean
  ) => {
    let finalUserTeam = { ...uTeam };
    const savedCareer = localStorage.getItem('cricket_c24_career');
    if (savedCareer) {
      try {
        const career = JSON.parse(savedCareer);
        const customPlayer: Player = {
          id: 'custom_cricketer',
          name: career.customCricketer.name,
          role: career.customCricketer.role,
          battingStyle: career.customCricketer.battingStyle,
          bowlingStyle: career.customCricketer.bowlingStyle,
          rating: 85,
          battingRating: career.customCricketer.stats.timing,
          bowlingRating: career.customCricketer.stats.control
        };
        // Inject custom cricketer as opener
        finalUserTeam.players = [customPlayer, ...uTeam.players.slice(1)];
      } catch (e) {
        console.warn('Failed to inject custom cricketer', e);
      }
    }

    setUserTeam(finalUserTeam);
    setOpponentTeam(oTeam);
    setOvers(matchOvers);
    setDifficulty(diff);
    setUserBatsFirst(uBatsFirst);

    // Initialize Innings 1
    const battingTeam = uBatsFirst ? uTeam : oTeam;
    const bowlingTeam = uBatsFirst ? oTeam : uTeam;

    const initialInnings: Innings = {
      runs: 0,
      wickets: 0,
      balls: 0,
      oversHistory: [],
      currentOver: [],
      batsman1: { player: battingTeam.players[0], runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false },
      batsman2: { player: battingTeam.players[1], runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false },
      currentBowler: { player: bowlingTeam.players[bowlerRosterIdx], overs: 0, maidens: 0, runs: 0, wickets: 0, balls: 0 },
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 }
    };

    setInnings1(initialInnings);
    setInnings2(null);
    setIsInnings1Active(true);
    setStrikerIdx(0);
    setActiveBatsmanIndex(0);
    setNextBatsmanIndex(2);
    setBowlerRosterIdx(9);
    setCommentaryList([
      `Welcome to Lord's! A gorgeous tournament day here.`,
      `First Innings starting. ${battingTeam.name} to bat first against ${bowlingTeam.name}.`,
      `${initialInnings.currentBowler.player.name} is preparing to bowl the opening over!`
    ]);
    setPhase('gameplay');
  };

  const setupMultiplayerMatch = (
    socket: WebSocket,
    roomCode: string,
    role: 'host' | 'guest',
    mode: 'competitive' | 'cooperative',
    uTeam: Team,
    oTeam: Team,
    matchOvers: number,
    diff: 'easy' | 'medium' | 'hard'
  ) => {
    setIsMpActive(true);
    setMpSocket(socket);
    setMpRole(role);
    setMpGameMode(mode);
    setMpRoomCode(roomCode);
    
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'opponent_delivered' || data.type === 'opponent_swung' || data.type === 'ball_result_synced') {
        setMpOpponentAction({ type: data.type, payload: data });
      }
    };

    const batsFirst = role === 'host';
    setupMatch(uTeam, oTeam, matchOvers, diff, batsFirst);
  };

  const setupTournamentMatch = (
    uTeam: Team,
    oTeam: Team,
    matchOvers: number,
    diff: 'easy' | 'medium' | 'hard',
    onComplete: (userWon: boolean, userScoreStr: string, opponentScoreStr: string) => void
  ) => {
    setIsTournamentMatch(true);
    setOnTournamentMatchComplete(() => onComplete);
    setupMatch(uTeam, oTeam, matchOvers, diff, true);
  };

  const handleMpEmitAction = (type: string, payload: any) => {
    if (mpSocket && mpSocket.readyState === WebSocket.OPEN) {
      mpSocket.send(JSON.stringify({
        type,
        roomCode: mpRoomCode,
        ...payload
      }));
    }
  };

  // Process ball completion physics and update scorecard state
  const handleBallCompleted = (
    runs: number,
    isWicket: boolean,
    outReason?: string,
    speed?: number,
    type?: string,
    pitchX?: number,
    pitchY?: number,
    shotAngle?: number,
    distance?: number
  ) => {
    const currentInnings = isInnings1Active ? innings1 : innings2;
    if (!currentInnings) return;

    setLastBallSpeed(speed);
    setLastBallType(type);

    const battingTeam = isInnings1Active 
      ? (userBatsFirst ? userTeam : opponentTeam)
      : (userBatsFirst ? opponentTeam : userTeam);
    
    const bowlingTeam = isInnings1Active
      ? (userBatsFirst ? opponentTeam : userTeam)
      : (userBatsFirst ? userTeam : opponentTeam);

    const bowler = currentInnings.currentBowler.player;
    const striker = activeBatsmanIndex === 0 ? currentInnings.batsman1 : currentInnings.batsman2;
    const nonStriker = activeBatsmanIndex === 0 ? currentInnings.batsman2 : currentInnings.batsman1;

    // Create delivery record
    const deliveryRecord: BallHistory = {
      ballNumber: (currentInnings.balls % 6) + 1,
      bowlerName: bowler.name,
      batsmanName: striker.player.name,
      runs,
      isWicket,
      wicketReason: outReason,
      deliveryType: type || 'Fast',
      speedKph: speed || 135,
      shotAngle,
      shotDistance: distance,
      pitchX: pitchX || 0,
      pitchY: pitchY || 15
    };

    // Update Scores
    const nextRuns = currentInnings.runs + runs;
    const nextWickets = currentInnings.wickets + (isWicket ? 1 : 0);
    const nextBalls = currentInnings.balls + 1;
    const nextCurrentOver = [...currentInnings.currentOver, deliveryRecord];

    // Update Striker batsman stats
    const updatedStriker = {
      ...striker,
      runs: striker.runs + runs,
      balls: striker.balls + 1,
      fours: striker.fours + (runs === 4 ? 1 : 0),
      sixes: striker.sixes + (runs === 6 ? 1 : 0),
      isOut: isWicket,
      outReason: isWicket ? outReason : undefined
    };

    // Update Bowler stats
    const updatedBowler = {
      ...currentInnings.currentBowler,
      runs: currentInnings.currentBowler.runs + runs,
      wickets: currentInnings.currentBowler.wickets + (isWicket ? 1 : 0),
      balls: currentInnings.currentBowler.balls + 1
    };

    // Construct next innings state
    let nextInningsState: Innings = {
      ...currentInnings,
      runs: nextRuns,
      wickets: nextWickets,
      balls: nextBalls,
      currentOver: nextCurrentOver,
      batsman1: activeBatsmanIndex === 0 ? updatedStriker : currentInnings.batsman1,
      batsman2: activeBatsmanIndex === 1 ? updatedStriker : currentInnings.batsman2,
      currentBowler: updatedBowler
    };

    // Generate Dynamic Commentary lines
    let commLine = '';
    const speedStr = speed ? `${speed.toFixed(1)}kph` : '';
    const overBallsStr = `${Math.floor(nextBalls / 6)}.${nextBalls % 6}`;

    if (isWicket) {
      commLine = `OUT! ${striker.player.name} falls! ${outReason}. A massive moment here. Score is ${nextRuns}/${nextWickets} (${overBallsStr} ov).`;
    } else if (runs === 6) {
      commLine = `SIX! Magnificent lofted stroke by ${striker.player.name}! It sails deep over the boundary rope (${distance}m)!`;
    } else if (runs === 4) {
      commLine = `FOUR! Superb cover drive from ${striker.player.name}. It splits the fielders and races to the boundary.`;
    } else if (runs === 0) {
      commLine = `Dot ball. Excellent length delivery from ${bowler.name} (${speedStr}). Striker blocked it comfortably.`;
    } else {
      commLine = `${runs} run${runs > 1 ? 's' : ''}. Steady rotation by ${striker.player.name}, pushing it into the gap.`;
    }

    const nextCommentary = [...commentaryList, commLine];

    // Check Wicket Fall substitution
    if (isWicket) {
      if (nextWickets < 10 && nextBatsmanIndex < battingTeam.players.length) {
        // Substitute incoming batsman
        const incomingPlayer = battingTeam.players[nextBatsmanIndex];
        
        nextInningsState = {
          ...nextInningsState,
          batsman1: activeBatsmanIndex === 0 
            ? { player: incomingPlayer, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false } 
            : nextInningsState.batsman1,
          batsman2: activeBatsmanIndex === 1 
            ? { player: incomingPlayer, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false } 
            : nextInningsState.batsman2
        };

        setNextBatsmanIndex(prev => prev + 1);
        nextCommentary.push(`Incoming batsman: ${incomingPlayer.name} is walking down the stadium stairs under the lights!`);
      }
    } else {
      // Rotation strike swap for odd single runs
      if (runs === 1 || runs === 3) {
        setActiveBatsmanIndex(prev => (prev === 0 ? 1 : 0));
      }
    }

    // Check End of Over (6 balls)
    const isOverEnded = nextBalls > 0 && nextBalls % 6 === 0;
    if (isOverEnded) {
      // Archive over history
      const finalOverHistory = [...nextInningsState.oversHistory, nextCurrentOver];
      
      // Select next bowler from roster to rotate
      // alternate bowlers from index 9, 10, 8
      let nextBowlerIdx = bowlerRosterIdx === 9 ? 10 : (bowlerRosterIdx === 10 ? 8 : 9);
      setBowlerRosterIdx(nextBowlerIdx);
      const nextBowler = bowlingTeam.players[nextBowlerIdx];

      nextInningsState = {
        ...nextInningsState,
        oversHistory: finalOverHistory,
        currentOver: [],
        currentBowler: { player: nextBowler, overs: 0, maidens: 0, runs: 0, wickets: 0, balls: 0 }
      };

      // Strike swap on end of over
      setActiveBatsmanIndex(prev => (prev === 0 ? 1 : 0));
      nextCommentary.push(`End of Over. Bowling change: ${nextBowler.name} is handed the ball from the southern end.`);
    }

    // Save Innings state
    if (isInnings1Active) {
      setInnings1(nextInningsState);
    } else {
      setInnings2(nextInningsState);
    }
    setCommentaryList(nextCommentary);

    // Evaluate Innings complete or Match complete conditions
    const maxMatchBalls = overs * 6;
    
    if (isInnings1Active) {
      // Innings 1 finishes
      if (nextBalls >= maxMatchBalls || nextWickets >= 10) {
        setTimeout(() => {
          triggerInningsBreak(nextRuns);
        }, 1500);
      }
    } else {
      // Innings 2 checks
      const targetRuns = innings1 ? innings1.runs + 1 : 0;
      
      if (nextRuns >= targetRuns) {
        // Chasers won! Match over!
        setTimeout(() => {
          setPhase('summary');
        }, 1500);
      } else if (nextBalls >= maxMatchBalls || nextWickets >= 10) {
        // Defenders won! Match over!
        setTimeout(() => {
          setPhase('summary');
        }, 1500);
      }
    }
  };

  const triggerInningsBreak = (firstInningsScore: number) => {
    setIsInnings1Active(false);
    setPhase('innings_break');
    audioEngine.playBoundaryCheer();

    // Create Innings 2 state
    const battingTeam = userBatsFirst ? opponentTeam : userTeam;
    const bowlingTeam = userBatsFirst ? userTeam : opponentTeam;
    
    // Reset batsman indexes for innings 2
    setStrikerIdx(0);
    setActiveBatsmanIndex(0);
    setNextBatsmanIndex(2);
    setBowlerRosterIdx(9);

    const initialInnings2: Innings = {
      runs: 0,
      wickets: 0,
      balls: 0,
      oversHistory: [],
      currentOver: [],
      batsman1: { player: battingTeam.players[0], runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false },
      batsman2: { player: battingTeam.players[1], runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false },
      currentBowler: { player: bowlingTeam.players[9], overs: 0, maidens: 0, runs: 0, wickets: 0, balls: 0 },
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 },
      target: firstInningsScore + 1
    };

    setInnings2(initialInnings2);
  };

  const startInnings2 = () => {
    setCommentaryList([
      `Innings 2 begins! Target is ${innings2?.target} runs off ${overs * 6} balls.`,
      `The bowler is pacing back, crowd is roaring under the sunset stadium glow! Let's play.`
    ]);
    setPhase('gameplay');
  };

  const resetAllMatchStates = () => {
    if (isTournamentMatch && onTournamentMatchComplete && innings1 && innings2) {
      const userRuns = userBatsFirst ? innings1.runs : innings2.runs;
      const oppRuns = userBatsFirst ? innings2.runs : innings1.runs;
      const userWon = userRuns >= oppRuns;
      
      const userWicketsStr = userBatsFirst ? innings1.wickets : innings2.wickets;
      const oppWicketsStr = userBatsFirst ? innings2.wickets : innings1.wickets;

      onTournamentMatchComplete(userWon, `${userRuns}/${userWicketsStr}`, `${oppRuns}/${oppWicketsStr}`);
      setIsTournamentMatch(false);
      setOnTournamentMatchComplete(null);
      setPhase('tournament');
    } else if (isCareerMatch && onCareerMatchComplete && innings1 && innings2) {
      const userRuns = userBatsFirst ? innings1.runs : innings2.runs;
      const oppWickets = userBatsFirst ? innings2.wickets : innings1.wickets; // wickets taken by user team bowling
      onCareerMatchComplete(userRuns, oppWickets);
      setIsCareerMatch(false);
      setOnCareerMatchComplete(null);
      setPhase('career');
    } else if (isMpActive) {
      setIsMpActive(false);
      if (mpSocket) mpSocket.close();
      setMpSocket(null);
      setMpRole(null);
      setMpOpponentAction(null);
      setPhase('multiplayer');
    } else {
      setPhase('menu');
    }
    setInnings1(null);
    setInnings2(null);
  };

  const activeInnings = isInnings1Active ? innings1 : innings2;
  const currentBattingTeam = isInnings1Active 
    ? (userBatsFirst ? userTeam : opponentTeam)
    : (userBatsFirst ? opponentTeam : userTeam);
  
  const currentBowlingTeam = isInnings1Active
    ? (userBatsFirst ? opponentTeam : userTeam)
    : (userBatsFirst ? userTeam : opponentTeam);

  const isUserCurrentlyBatting = isInnings1Active ? userBatsFirst : !userBatsFirst;

  return (
    <div className="min-h-screen bg-[#0A0F0D] text-white flex flex-col justify-between" id="applet-root">
      {/* Dynamic Header */}
      <header className="border-b border-white/10 bg-[#0A0F0D]/95 px-6 py-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-emerald flex items-center justify-center font-black text-black text-sm shadow-[0_0_10px_rgba(0,255,133,0.3)]">
            C24
          </div>
          <div>
            <span className="text-xs font-black text-brand-emerald block tracking-widest uppercase text-glow-emerald">Arena 2026</span>
            <span className="font-extrabold text-sm text-neutral-100 uppercase tracking-tight">Cricket 24 Simulator</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Help Instructions Toggler */}
          <button 
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 rounded-lg text-xs font-bold flex items-center gap-1 transition uppercase tracking-wider"
          >
            <HelpCircle size={15} /> <span className="hidden sm:inline">Controls Guide</span>
          </button>
        </div>
      </header>

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col justify-center gap-6">
        <AnimatePresence mode="wait">
          {/* Main Menu Screen */}
          {phase === 'menu' && (
            <motion.div 
              key="menu"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="flex flex-col items-center justify-center text-center max-w-xl mx-auto py-12"
            >
              <div className="relative mb-6">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-brand-emerald to-brand-sky opacity-35 blur" />
                <div className="relative w-20 h-20 bg-black border border-white/10 rounded-full flex items-center justify-center text-3xl shadow-xl shadow-brand-emerald/10">
                  🏏
                </div>
              </div>

              <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase leading-none bg-gradient-to-b from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
                CRICKET 24 <br/>
                <span className="text-brand-emerald text-glow-emerald">SIMULATOR</span>
              </h1>
              <p className="text-neutral-300 text-sm md:text-base mt-4 font-medium leading-relaxed max-w-md uppercase tracking-wide opacity-85">
                Experience high-fidelity 3D perspective physics, custom Web Audio stadium atmospherics, real-time ball trajectories, and TV score overlays.
              </p>

              <div className="flex flex-col gap-3.5 w-full max-w-sm mt-8">
                <button
                  onClick={startTossPhase}
                  className="py-3.5 bg-gradient-to-r from-brand-emerald to-brand-sky hover:opacity-95 text-black font-black uppercase rounded-xl tracking-widest shadow-lg shadow-brand-emerald/20 transition transform active:scale-95 flex items-center justify-center gap-2 text-xs"
                >
                  🏏 Play Quick Exhibition Match
                </button>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      audioEngine.init();
                      setPhase('career');
                    }}
                    className="py-3.5 bg-gradient-to-tr from-amber-500/10 to-orange-500/5 hover:bg-amber-500/15 border border-amber-500/20 text-amber-200 font-black text-[10px] uppercase tracking-wider rounded-xl transition flex flex-col items-center justify-center gap-1.5"
                  >
                    <span>⭐</span> Pro Career Mode
                  </button>
                  <button
                    onClick={() => {
                      audioEngine.init();
                      setPhase('tournament');
                    }}
                    className="py-3.5 bg-gradient-to-tr from-brand-sky/15 to-brand-emerald/5 hover:bg-brand-sky/20 border border-brand-sky/25 text-brand-sky font-black text-[10px] uppercase tracking-wider rounded-xl transition flex flex-col items-center justify-center gap-1.5"
                  >
                    <span>🏆</span> Tournament Cups
                  </button>
                </div>

                <button
                  onClick={() => {
                    audioEngine.init();
                    setPhase('multiplayer');
                  }}
                  className="py-3.5 bg-gradient-to-r from-[#38bdf8] to-[#22c55e] hover:opacity-95 text-black font-black uppercase rounded-xl tracking-widest shadow-md transition transform active:scale-95 flex items-center justify-center gap-2 text-xs"
                >
                  🌐 Online Multiplayer Arena
                </button>

                <button
                  onClick={() => setShowHelp(true)}
                  className="py-3 bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest transition"
                >
                  Controls & Game Guide
                </button>
              </div>

              <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] uppercase font-bold tracking-widest mt-10">
                <Trophy size={11} className="text-brand-emerald" /> Lord's Cricket Ground Stadium
              </div>
            </motion.div>
          )}

          {/* Lobby Setup (Team Selection) */}
          {phase === 'team_select' && (
            <motion.div 
              key="team_select"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <TeamSelector onSetupCompleted={setupMatch} />
            </motion.div>
          )}

          {/* Pro Career Campaign Screen */}
          {phase === 'career' && (
            <motion.div
              key="career"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full"
            >
              <CareerMode 
                onBackToMenu={() => setPhase('menu')} 
                onPlayCareerMatch={(uTeam, oTeam, oLimit, diff, onComplete) => {
                  setIsCareerMatch(true);
                  setOnCareerMatchComplete(() => onComplete);
                  setupMatch(uTeam, oTeam, oLimit, diff, true);
                }}
              />
            </motion.div>
          )}

          {/* Tournament Campaign Screen */}
          {phase === 'tournament' && (
            <motion.div
              key="tournament"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full"
            >
              <TournamentMode 
                onBackToMenu={() => setPhase('menu')} 
                onPlayTournamentMatch={setupTournamentMatch}
              />
            </motion.div>
          )}

          {/* Multiplayer Online Arena Screen */}
          {phase === 'multiplayer' && (
            <motion.div
              key="multiplayer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full"
            >
              <MultiplayerLobby 
                onBackToMenu={() => setPhase('menu')} 
                onStartMultiplayerGame={setupMultiplayerMatch}
              />
            </motion.div>
          )}

          {/* Core Gameplay Screen */}
          {phase === 'gameplay' && activeInnings && (
            <motion.div 
              key="gameplay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
            >
              {/* Left Column: Canvas, Scoreboard overlay */}
              <div className="lg:col-span-2 flex flex-col gap-5">
                {/* TV Score Overlay */}
                <BroadcastScoreboard
                  battingTeam={currentBattingTeam}
                  bowlingTeam={currentBowlingTeam}
                  innings={activeInnings}
                  currentOverNum={Math.floor(activeInnings.balls / 6) + 1}
                  isSecondInnings={!isInnings1Active}
                  activeBatsmanIndex={activeBatsmanIndex}
                  recentDeliveries={activeInnings.currentOver}
                  lastSpeedKph={lastBallSpeed}
                  lastDeliveryType={lastBallType}
                />

                {/* 3D-Perspective Canvas Stadium */}
                <StadiumCanvas
                  battingTeam={currentBattingTeam}
                  bowlingTeam={currentBowlingTeam}
                  activeBatsman={activeBatsmanIndex === 0 ? activeInnings.batsman1.player : activeInnings.batsman2.player}
                  currentBowler={activeInnings.currentBowler.player}
                  isUserBatting={isUserCurrentlyBatting}
                  difficulty={difficulty}
                  innings={activeInnings}
                  onBallCompleted={handleBallCompleted}
                  isMultiplayer={isMpActive}
                  mpRole={mpRole}
                  mpOpponentAction={mpOpponentAction}
                  mpEmitAction={handleMpEmitAction}
                />
              </div>

              {/* Right Column: Commentary & Side info bar */}
              <div className="flex flex-col gap-5">
                <CommentaryBox 
                  currentCommentaryList={commentaryList} 
                  ballHistory={activeInnings.oversHistory.flat()}
                  lastBall={activeInnings.currentOver[activeInnings.currentOver.length - 1]}
                />

                {/* Side Card: Batter Lineups */}
                <div className="bg-[#0A0F0D]/90 border border-white/10 p-4.5 rounded-xl shadow-2xl">
                  <h3 className="text-xs font-black text-white uppercase tracking-widest mb-3.5 border-b border-white/10 pb-2 flex items-center gap-1.5">
                    🏏 {currentBattingTeam.name} BATTING CARD
                  </h3>
                  <div className="flex flex-col gap-2">
                    {currentBattingTeam.players.slice(0, 5).map((p, idx) => {
                      const isAtCrease = (activeInnings.batsman1.player.id === p.id) || (activeInnings.batsman2.player.id === p.id);
                      return (
                        <div key={idx} className={`flex items-center justify-between text-xs p-2.5 rounded-lg border transition-all ${
                          isAtCrease 
                            ? 'bg-brand-emerald/10 border-brand-emerald/30 text-brand-emerald shadow-[0_0_10px_rgba(0,255,133,0.05)]' 
                            : 'bg-black/40 border-white/5 text-neutral-400'
                        }`}>
                          <span className="font-black uppercase tracking-wide italic">{p.name}</span>
                          <span className="text-[9px] font-bold text-neutral-400 bg-white/5 px-2 py-0.5 rounded uppercase tracking-wider">{p.role}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Match Information HUD */}
                <div className="bg-[#0A0F0D]/90 border border-white/10 p-4.5 rounded-xl text-xs flex flex-col gap-3 shadow-2xl">
                  <div className="flex justify-between items-center text-neutral-400">
                    <span className="font-bold uppercase tracking-wider text-[10px]">Overs Limit:</span>
                    <span className="font-black text-white bg-white/5 px-2 py-0.5 rounded border border-white/10">{overs} Overs</span>
                  </div>
                  <div className="flex justify-between items-center text-neutral-400">
                    <span className="font-bold uppercase tracking-wider text-[10px]">AI Pitch Difficulty:</span>
                    <span className="font-black text-brand-emerald bg-brand-emerald/10 px-2 py-0.5 rounded border border-brand-emerald/20 uppercase text-glow-emerald">{difficulty}</span>
                  </div>
                  <div className="flex justify-between items-center text-neutral-400">
                    <span className="font-bold uppercase tracking-wider text-[10px]">Stadium Weather:</span>
                    <span className="font-black text-brand-sky bg-brand-sky/10 px-2 py-0.5 rounded border border-brand-sky/20 uppercase">SUNSET GLOW</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Innings Break Interval Overlay */}
          {phase === 'innings_break' && innings1 && (
            <motion.div 
              key="innings_break"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-md mx-auto bg-[#0A0F0D]/95 border border-white/10 p-6 rounded-2xl shadow-2xl text-center flex flex-col items-center"
            >
              <div className="w-14 h-14 rounded-full bg-brand-emerald/10 border border-brand-emerald/30 flex items-center justify-center text-brand-emerald mb-4 shadow-[0_0_15px_rgba(0,255,133,0.1)]">
                <Trophy size={28} />
              </div>
              <h2 className="text-xl font-black italic uppercase tracking-wider text-white">Innings Complete</h2>
              <div className="my-5 p-4 bg-black/60 rounded-xl border border-white/10 w-full">
                <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest block mb-1">
                  First Innings Score
                </span>
                <span className="text-3xl font-black text-brand-emerald text-glow-emerald">
                  {innings1.runs} <span className="text-lg text-neutral-500 font-bold">/</span> {innings1.wickets}
                </span>
                <p className="text-xs text-neutral-400 font-semibold mt-2 uppercase">
                  Completed in {Math.floor(innings1.balls / 6)}.{innings1.balls % 6} overs
                </p>
              </div>

              <p className="text-xs text-neutral-300 font-bold uppercase tracking-wide leading-relaxed">
                The target for <span className="text-brand-sky font-black">{opponentTeam.name}</span> is <span className="text-brand-emerald text-sm font-black text-glow-emerald">{innings1.runs + 1} runs</span>.
              </p>

              <button
                onClick={startInnings2}
                className="w-full mt-6 py-3 bg-gradient-to-r from-brand-emerald to-brand-sky hover:opacity-95 text-black font-black uppercase rounded-xl text-xs tracking-widest transition shadow-[0_0_15px_rgba(0,255,133,0.25)]"
              >
                Start Second Innings Chase
              </button>
            </motion.div>
          )}

          {/* Final Match Summary */}
          {phase === 'summary' && innings1 && innings2 && (
            <motion.div 
              key="summary"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <MatchSummary
                userTeam={userTeam}
                opponentTeam={opponentTeam}
                innings1={innings1}
                innings2={innings2}
                userBatsFirst={userBatsFirst}
                onPlayAgain={resetAllMatchStates}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer copyright */}
      <footer className="border-t border-white/10 bg-black/40 py-4 text-center text-[10px] text-neutral-500 font-black uppercase tracking-[0.2em] relative">
        Cricket 24 Simulator • Powered by React & HTML5 Canvas Physics
      </footer>

      {/* Bottom Edge Garnish - Artistic Flair exact specification */}
      <div className="w-full h-1 bg-gradient-to-r from-brand-emerald via-brand-sky to-brand-emerald"></div>

      {/* Guide/Controls Modal Dialog Overlay */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn" id="guide-modal">
          <div className="bg-[#0A0F0D]/95 border border-white/15 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-emerald to-brand-sky" />
            
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h2 className="text-base font-black text-brand-emerald uppercase tracking-widest flex items-center gap-1.5 text-glow-emerald">
                <HelpCircle size={18} /> GAMEPLAY CONTROLS
              </h2>
              <button 
                onClick={() => setShowHelp(false)}
                className="text-neutral-400 hover:text-white font-black text-xs uppercase tracking-wider"
              >
                ✕ Close
              </button>
            </div>

            {/* batting guides */}
            <div className="flex flex-col gap-2.5">
              <h3 className="text-xs font-black text-white uppercase tracking-widest border-l-2 border-brand-emerald pl-2">
                🏏 Batting Mechanics
              </h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                As the bowler delivers, select your shot direction and swing with precise timing to match the ball bounce target.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-1 text-[11px]">
                <div className="bg-black/60 p-2.5 rounded-lg border border-white/5">
                  <span className="font-black text-brand-emerald block mb-0.5 uppercase tracking-wide">Left / Right / A / D</span>
                  Direct your stroke angle (Offside vs Legside).
                </div>
                <div className="bg-black/60 p-2.5 rounded-lg border border-white/5">
                  <span className="font-black text-brand-emerald block mb-0.5 uppercase tracking-wide">Up / Down / W / S</span>
                  Toggle between Grounded stroke or high Lofted drive.
                </div>
                <div className="bg-black/60 p-2.5 rounded-lg border border-white/5 col-span-2">
                  <span className="font-black text-brand-emerald block mb-0.5 uppercase tracking-wide">Spacebar / Strike Button</span>
                  Swing the bat. Hit precisely as the ball is about to reach the crease to score boundaries!
                </div>
              </div>
            </div>

            {/* bowling guides */}
            <div className="flex flex-col gap-2.5 border-t border-white/10 pt-4">
              <h3 className="text-xs font-black text-white uppercase tracking-widest border-l-2 border-brand-sky pl-2">
                🥎 Bowling Mechanics
              </h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Set the delivery target, choose spin vs pace swing, then release on the green power segment.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-1 text-[11px]">
                <div className="bg-black/60 p-2.5 rounded-lg border border-white/5">
                  <span className="font-black text-brand-sky block mb-0.5 uppercase tracking-wide">WASD / Arrow Keys</span>
                  Position the yellow landing pitch circle target.
                </div>
                <div className="bg-black/60 p-2.5 rounded-lg border border-white/5">
                  <span className="font-black text-brand-sky block mb-0.5 uppercase tracking-wide">Spacebar Release</span>
                  Click Space to start bowler run-up, and hit Space again inside the <span className="text-brand-emerald font-black">GREEN SWEET SPOT</span> for maximum delivery quality!
                </div>
              </div>
            </div>

            {/* running guides */}
            <div className="flex flex-col gap-2 border-t border-white/10 pt-4">
              <h3 className="text-xs font-black text-white uppercase tracking-widest border-l-2 border-brand-emerald pl-2">
                🏃 Running Between Wickets
              </h3>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Once hit, click <span className="text-brand-emerald font-black">Sprint Run</span> (or Spacebar/R) to run. Tap it again to turn and sprint back. Tap <span className="text-neutral-400 font-bold">Stay Safe</span> to stand firm in the crease to prevent run-outs!
              </p>
            </div>

            <button 
              onClick={() => setShowHelp(false)}
              className="w-full mt-2 py-3 bg-brand-emerald hover:opacity-95 text-black font-black uppercase text-xs rounded-xl tracking-widest shadow-[0_0_15px_rgba(0,255,133,0.3)]"
            >
              Let's Play
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
