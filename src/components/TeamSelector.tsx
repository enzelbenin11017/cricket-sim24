import React, { useState } from 'react';
import { Team } from '../types';
import { TEAMS, MATCH_OVERS_OPTIONS, DIFFICULTY_OPTIONS } from '../lib/teamsData';
import { motion } from 'motion/react';
import { Play, ArrowRight, ShieldAlert, Award, Star, Settings } from 'lucide-react';
import { audioEngine } from '../lib/audio';

interface TeamSelectorProps {
  onSetupCompleted: (
    userTeam: Team,
    opponentTeam: Team,
    overs: number,
    difficulty: 'easy' | 'medium' | 'hard',
    userBatsFirst: boolean
  ) => void;
}

export const TeamSelector: React.FC<TeamSelectorProps> = ({ onSetupCompleted }) => {
  const [userTeam, setUserTeam] = useState<Team>(TEAMS[0]); // Default India
  const [opponentTeam, setOpponentTeam] = useState<Team>(TEAMS[1]); // Default Australia
  const [overs, setOvers] = useState<number>(2);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  
  // Toss stage states
  const [tossStage, setTossStage] = useState<'coin-toss' | 'toss-result' | 'ready'>('coin-toss');
  const [userCoinChoice, setUserCoinChoice] = useState<'Heads' | 'Tails' | null>(null);
  const [isCoinFlipping, setIsCoinFlipping] = useState(false);
  const [tossWinner, setTossWinner] = useState<'User' | 'Opponent' | null>(null);
  const [userBatsFirst, setUserBatsFirst] = useState<boolean>(true);
  const [tossText, setTossText] = useState('');

  const handleSelectUserTeam = (team: Team) => {
    setUserTeam(team);
    // Auto shift opponent if matching
    if (opponentTeam.id === team.id) {
      const nextOpp = TEAMS.find(t => t.id !== team.id);
      if (nextOpp) setOpponentTeam(nextOpp);
    }
    audioEngine.playBatHit(0.4);
  };

  const handleSelectOpponentTeam = (team: Team) => {
    if (team.id === userTeam.id) return; // Can't play against self
    setOpponentTeam(team);
    audioEngine.playBatHit(0.4);
  };

  const startTossCoinFlip = (choice: 'Heads' | 'Tails') => {
    setUserCoinChoice(choice);
    setIsCoinFlipping(true);
    audioEngine.playSwoosh();

    setTimeout(() => {
      setIsCoinFlipping(false);
      const isHeads = Math.random() < 0.5;
      const coinResult = isHeads ? 'Heads' : 'Tails';
      const userWon = choice === coinResult;

      setTossStage('toss-result');
      
      if (userWon) {
        setTossWinner('User');
        setTossText(`You won the toss! The coin landed on ${coinResult}. Select your match strategy:`);
      } else {
        setTossWinner('Opponent');
        const aiBatsFirst = Math.random() < 0.5;
        setUserBatsFirst(!aiBatsFirst);
        setTossText(`${opponentTeam.name} won the toss (coin landed on ${coinResult}) and decided to ${aiBatsFirst ? 'BAT' : 'BOWL'} first!`);
      }
    }, 1800);
  };

  const chooseTossDecision = (decideToBat: boolean) => {
    setUserBatsFirst(decideToBat);
    setTossStage('ready');
    audioEngine.playBatHit(0.6);
  };

  const handleStartGame = () => {
    audioEngine.startAmbient();
    audioEngine.playBoundaryCheer();
    onSetupCompleted(userTeam, opponentTeam, overs, difficulty, userBatsFirst);
  };

  return (
    <div className="w-full flex flex-col gap-6 font-sans text-white p-2" id="pre-match-lobby">
      
      {/* Immersive Stadium Simulation Header Background */}
      <div className="text-center py-4 relative rounded-2xl overflow-hidden bg-[radial-gradient(circle_at_50%_120%,#1B4332_0%,#081C15_80%)] border border-white/10 p-6 shadow-2xl">
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808033_1px,transparent_1px),linear-gradient(to_bottom,#80808033_1px,transparent_1px)] bg-[size:24px_24px]" />
        
        <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase leading-none bg-gradient-to-r from-white via-neutral-100 to-brand-emerald bg-clip-text text-transparent">
          CRICKET 24 <span className="text-brand-emerald text-glow-emerald">SIMULATOR</span>
        </h1>
        <p className="text-neutral-300 text-xs md:text-sm mt-2 font-bold tracking-wider max-w-xl mx-auto uppercase opacity-80">
          Setup your tournament match, run-rates, and lead your nation to victory!
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Team Kits & Rosters */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          
          {/* User Team Selection */}
          <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-xl">
            <span className="text-[10px] font-black text-brand-emerald tracking-widest uppercase block mb-3">
              1. CHOOSE YOUR COUNTRY
            </span>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
              {TEAMS.map((team) => (
                <button
                  key={team.id}
                  onClick={() => handleSelectUserTeam(team)}
                  className={`relative p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all duration-200 transform active:scale-95 ${
                    userTeam.id === team.id
                      ? 'bg-white/10 border-brand-emerald shadow-[0_0_15px_rgba(0,255,133,0.15)] ring-1 ring-brand-emerald/30 text-brand-emerald'
                      : 'bg-black/40 border-white/5 hover:border-white/15'
                  }`}
                >
                  <span className="text-3xl filter drop-shadow">{team.flagEmoji}</span>
                  <span className="text-xs font-black tracking-wide uppercase">{team.name}</span>
                  {userTeam.id === team.id && (
                    <div className="absolute bottom-1 w-6 h-0.5 rounded-full bg-brand-emerald" />
                  )}
                </button>
              ))}
            </div>

            {/* User Team roster preview */}
            <div className="mt-5 p-4 bg-black/60 border border-white/15 rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl filter drop-shadow">{userTeam.flagEmoji}</span>
                <div>
                  <h3 className="font-black italic uppercase text-sm tracking-wide text-white">{userTeam.name} National Roster</h3>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wide">Captain: {userTeam.players[0].name} • Star Bowler: {userTeam.players[9].name}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-[10px] font-mono font-black text-brand-emerald bg-brand-emerald/10 px-2.5 py-1 rounded border border-brand-emerald/20 uppercase tracking-widest">
                  BAT: 94
                </span>
                <span className="text-[10px] font-mono font-black text-brand-sky bg-brand-sky/10 px-2.5 py-1 rounded border border-brand-sky/20 uppercase tracking-widest">
                  BOWL: 92
                </span>
              </div>
            </div>
          </div>

          {/* Opponent Team Selection */}
          <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-xl">
            <span className="text-[10px] font-black text-brand-sky tracking-widest uppercase block mb-3">
              2. CHOOSE OPPONENT NATION
            </span>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5">
              {TEAMS.map((team) => {
                const isSelectedSelf = userTeam.id === team.id;
                return (
                  <button
                    key={team.id}
                    disabled={isSelectedSelf}
                    onClick={() => handleSelectOpponentTeam(team)}
                    className={`relative p-3.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all duration-200 transform active:scale-95 ${
                      isSelectedSelf ? 'opacity-30 cursor-not-allowed' : ''
                    } ${
                      opponentTeam.id === team.id && !isSelectedSelf
                        ? 'bg-white/10 border-brand-sky shadow-[0_0_15px_rgba(0,163,255,0.15)] ring-1 ring-brand-sky/30 text-brand-sky'
                        : 'bg-black/40 border-white/5 hover:border-white/15'
                    }`}
                  >
                    <span className="text-3xl filter drop-shadow">{team.flagEmoji}</span>
                    <span className="text-xs font-black tracking-wide uppercase">{team.name}</span>
                    {opponentTeam.id === team.id && !isSelectedSelf && (
                      <div className="absolute bottom-1 w-6 h-0.5 rounded-full bg-brand-sky" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step 2: Match Settings & Toss Coin */}
        <div className="flex flex-col gap-5">
          {/* Settings Parameters */}
          <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-xl flex flex-col gap-4">
            <span className="text-[10px] font-black text-neutral-300 tracking-widest uppercase block border-b border-white/10 pb-2">
              <Settings size={12} className="inline mr-1 text-brand-emerald" /> Match Rules
            </span>

            {/* Overs Match */}
            <div>
              <label className="text-[10px] uppercase tracking-wider font-black text-neutral-300 block mb-2">Match Length (Overs)</label>
              <div className="flex flex-col gap-1.5">
                {MATCH_OVERS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setOvers(opt.value)}
                    className={`p-3 rounded-lg border text-left text-xs font-bold uppercase transition-all duration-150 ${
                      overs === opt.value
                        ? 'bg-brand-emerald border-brand-emerald text-black font-black shadow-[0_0_12px_rgba(0,255,133,0.25)]'
                        : 'bg-black/50 border-white/5 hover:border-white/15 text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Difficulty match */}
            <div className="mt-1">
              <label className="text-[10px] uppercase tracking-wider font-black text-neutral-300 block mb-2">AI Pitch Difficulty</label>
              <div className="flex gap-1.5">
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDifficulty(opt.value as any)}
                    className={`flex-1 py-2.5 rounded-lg border text-center text-xs font-black uppercase transition-all duration-150 ${
                      difficulty === opt.value
                        ? 'bg-brand-sky border-brand-sky text-black shadow-[0_0_12px_rgba(0,163,255,0.25)]'
                        : 'bg-black/50 border-white/5 hover:border-white/15 text-white'
                    }`}
                  >
                    {opt.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Toss Module */}
          <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-xl flex-1 flex flex-col justify-between min-h-[220px]">
            <div>
              <span className="text-[10px] font-black text-brand-emerald tracking-widest uppercase block mb-3 border-b border-white/10 pb-2">
                3. THE TOSS DECISION
              </span>

              {tossStage === 'coin-toss' && (
                <div className="text-center flex flex-col items-center py-2">
                  <p className="text-xs text-neutral-300 font-bold mb-4 uppercase tracking-wide">
                    Call Heads or Tails to flip the match coin!
                  </p>

                  <div className="flex gap-2.5 justify-center w-full">
                    <button
                      onClick={() => startTossCoinFlip('Heads')}
                      disabled={isCoinFlipping}
                      className="flex-1 py-3 bg-black/60 hover:bg-white/5 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wide transition transform active:scale-95"
                    >
                      🗣 Heads
                    </button>
                    <button
                      onClick={() => startTossCoinFlip('Tails')}
                      disabled={isCoinFlipping}
                      className="flex-1 py-3 bg-black/60 hover:bg-white/5 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wide transition transform active:scale-95"
                    >
                      🗣 Tails
                    </button>
                  </div>
                </div>
              )}

              {isCoinFlipping && (
                <div className="flex flex-col items-center justify-center py-6">
                  {/* Dynamic spinning coin with motion */}
                  <motion.div
                    animate={{ rotateY: 360 * 4 }}
                    transition={{ repeat: Infinity, duration: 0.6, ease: 'linear' }}
                    className="w-12 h-12 rounded-full bg-brand-emerald border-4 border-white/20 flex items-center justify-center text-black font-black text-lg shadow-[0_0_15px_#00FF85]"
                  >
                    ¢
                  </motion.div>
                  <span className="text-[10px] font-black tracking-widest text-brand-emerald uppercase mt-3 animate-pulse">Flipping coin...</span>
                </div>
              )}

              {tossStage === 'toss-result' && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-200">{tossText}</p>
                  
                  {tossWinner === 'User' ? (
                    <div className="flex gap-2 w-full mt-1">
                      <button
                        onClick={() => chooseTossDecision(true)}
                        className="flex-1 py-3 bg-brand-emerald hover:bg-brand-emerald/90 text-black font-black text-xs uppercase rounded-xl shadow-[0_0_12px_rgba(0,255,133,0.25)]"
                      >
                        🏏 Bat First
                      </button>
                      <button
                        onClick={() => chooseTossDecision(false)}
                        className="flex-1 py-3 bg-brand-sky hover:bg-brand-sky/90 text-black font-black text-xs uppercase rounded-xl shadow-[0_0_12px_rgba(0,163,255,0.25)]"
                      >
                        🥎 Bowl First
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setTossStage('ready')}
                      className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider mt-1"
                    >
                      Continue
                    </button>
                  )}
                </div>
              )}

              {tossStage === 'ready' && (
                <div className="flex flex-col gap-2.5 py-2">
                  <p className="text-xs font-bold text-neutral-200 uppercase tracking-wide">
                    Strategy set! You will <span className="text-brand-emerald font-black text-glow-emerald">{userBatsFirst ? 'BAT' : 'BOWL'}</span> first in the match.
                  </p>
                  <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wide leading-relaxed">
                    Press Play Match below to start the innings and enter the live stadium atmospheric simulation.
                  </p>
                </div>
              )}
            </div>

            {tossStage === 'ready' && (
              <button
                onClick={handleStartGame}
                className="w-full mt-4 py-3 bg-gradient-to-r from-brand-emerald to-brand-sky hover:from-brand-emerald/90 hover:to-brand-sky/90 text-black font-black uppercase rounded-xl text-xs tracking-widest flex items-center justify-center gap-2 transition transform active:scale-95 shadow-[0_0_20px_rgba(0,255,133,0.3)]"
              >
                🏏 Start Match Session <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
