import React from 'react';
import { Innings, Team, BallHistory } from '../types';
import { Trophy, Compass, ArrowRight, Star, HelpCircle } from 'lucide-react';

interface BroadcastScoreboardProps {
  battingTeam: Team;
  bowlingTeam: Team;
  innings: Innings;
  currentOverNum: number;
  isSecondInnings: boolean;
  activeBatsmanIndex: number; // 0 or 1
  recentDeliveries: BallHistory[];
  lastSpeedKph?: number;
  lastDeliveryType?: string;
}

export const BroadcastScoreboard: React.FC<BroadcastScoreboardProps> = ({
  battingTeam,
  bowlingTeam,
  innings,
  currentOverNum,
  isSecondInnings,
  activeBatsmanIndex,
  recentDeliveries,
  lastSpeedKph,
  lastDeliveryType,
}) => {
  const oversPlayed = Math.floor(innings.balls / 6);
  const ballsInOver = innings.balls % 6;
  const currentRR = innings.balls > 0 ? ((innings.runs / innings.balls) * 6).toFixed(2) : '0.00';
  
  // Calculate required run rate
  let requiredRR = '0.00';
  let runsNeeded = 0;
  let ballsRemaining = 0;
  if (isSecondInnings && innings.target) {
    runsNeeded = innings.target - innings.runs;
    // Assume 2 overs is 12 balls, 5 overs is 30 balls, etc. 
    // We can compute based on the total overs from the app
    const maxMatchBalls = (innings.target > 25 ? 30 : 12); // ballpark, but we can read from standard over structures
    // Let's use activeInnings or estimated total balls
    const estimatedTotalBalls = 12; // fallback if undefined
    ballsRemaining = Math.max(0, estimatedTotalBalls - innings.balls);
    if (ballsRemaining > 0) {
      requiredRR = ((runsNeeded / ballsRemaining) * 6).toFixed(2);
    }
  }

  const activeBatsman = activeBatsmanIndex === 0 ? innings.batsman1 : innings.batsman2;
  const nonActiveBatsman = activeBatsmanIndex === 0 ? innings.batsman2 : innings.batsman1;

  // Calculate some simple match stats
  const activeSR = activeBatsman.balls > 0 ? ((activeBatsman.runs / activeBatsman.balls) * 100).toFixed(1) : '0.0';
  const partnerRuns = innings.batsman1.runs + innings.batsman2.runs;
  const partnerBalls = innings.batsman1.balls + innings.batsman2.balls;

  const bowlerEcon = innings.currentBowler.balls > 0 
    ? ((innings.currentBowler.runs / innings.currentBowler.balls) * 6).toFixed(1) 
    : '0.0';

  return (
    <div className="w-full flex flex-col gap-4 font-sans text-white select-none" id="broadcast-scoreboard">
      
      {/* Top Banner: Match Context with Live simulation details */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#0A0F0D]/90 border-b border-white/15 p-4 rounded-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 px-4 py-2 border-l-4 border-brand-emerald">
            <p className="text-[9px] uppercase tracking-[0.2em] opacity-60 font-black mb-0.5">WORLD CHAMPIONSHIP</p>
            <h1 className="text-xl font-black italic uppercase leading-none tracking-tight">
              {battingTeam.shortName} <span className="text-brand-emerald">VS</span> {bowlingTeam.shortName}
            </h1>
          </div>
          <div className="bg-black/30 px-4 py-2 border-l-4 border-white/20">
            <p className="text-[9px] uppercase tracking-[0.2em] opacity-60 font-black mb-0.5">CURRENT STAGE</p>
            <p className="text-xs font-bold uppercase tracking-wide">
              {isSecondInnings ? '2ND INNINGS CHASE' : '1ST INNINGS RUNS'}
            </p>
          </div>
        </div>

        {/* Live Simulation Indicator & Environment stats */}
        <div className="flex items-center gap-4 ml-auto sm:ml-0">
          <div className="bg-red-600/90 text-white font-black italic uppercase tracking-wider text-[9px] px-3 py-1 rounded-sm shadow-[0_0_8px_rgba(220,38,38,0.4)] animate-pulse">
            LIVE BROADCAST
          </div>
          <div className="hidden md:flex items-center gap-4 bg-white/5 border border-white/10 px-3 py-1 rounded text-[10px]">
            <div>
              <span className="opacity-50 uppercase block text-[8px] tracking-wider">Speed Gun</span>
              <span className="font-mono text-brand-emerald font-bold">{lastSpeedKph ? `${lastSpeedKph.toFixed(1)} Kph` : '134.2 Kph'}</span>
            </div>
            <div className="w-[1px] h-5 bg-white/10" />
            <div>
              <span className="opacity-50 uppercase block text-[8px] tracking-wider">Humidity</span>
              <span className="font-mono font-bold">48% NW</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Scorecard Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        
        {/* Left 2 Cols: Active Batsmen Details & Run Progress */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          
          {/* Active Batter card - Exact Artistic Flair implementation */}
          <div className="flex flex-col sm:flex-row items-stretch gap-1 rounded-xl overflow-hidden shadow-2xl">
            {/* Banner block for batter title */}
            <div className="bg-brand-emerald text-black p-4 flex flex-col justify-center min-w-[200px] sm:max-w-[240px] flex-shrink-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
                <p className="text-[10px] uppercase font-black tracking-widest leading-none">On Strike</p>
              </div>
              <h2 className="text-2xl font-black italic uppercase leading-none truncate">
                {activeBatsman.player.name}
              </h2>
              <span className="text-[10px] font-bold opacity-75 mt-1 uppercase block tracking-wider">
                {activeBatsman.player.role}
              </span>
            </div>

            {/* Live stats scoreboard strip */}
            <div className="flex-1 bg-black/80 backdrop-blur-xl p-4 flex flex-wrap gap-6 items-center justify-between border-t sm:border-t-0 sm:border-l border-white/10">
              <div className="flex gap-6 items-center">
                <div>
                  <p className="text-[9px] uppercase tracking-wider opacity-50 mb-0.5">Runs</p>
                  <p className="text-3xl font-black font-mono text-brand-emerald text-glow-emerald">
                    {activeBatsman.runs}*
                  </p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider opacity-50 mb-0.5">Balls</p>
                  <p className="text-2xl font-bold font-mono text-neutral-100">
                    {activeBatsman.balls}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider opacity-50 mb-0.5">S/R</p>
                  <p className="text-lg font-bold font-mono text-neutral-400">
                    {activeSR}
                  </p>
                </div>
              </div>

              {/* Graphical momentum bars */}
              <div className="flex gap-1 items-end h-10 ml-auto pr-2">
                <div className="w-1 h-5 bg-white/20 rounded-t-sm" />
                <div className="w-1 h-7 bg-white/30 rounded-t-sm" />
                <div className="w-1 h-4 bg-white/20 rounded-t-sm" />
                <div className="w-1 h-9 bg-brand-emerald rounded-t-sm shadow-[0_0_8px_#00FF85]" />
                <div className="w-1 h-6 bg-white/40 rounded-t-sm" />
              </div>
            </div>
          </div>

          {/* Dynamic Score and Partnership metrics */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white/10 backdrop-blur-md p-4 rounded-xl border-t-2 border-white box-glow-emerald">
            <div className="pr-6 sm:border-r border-white/20 flex flex-col justify-center">
              <p className="text-[10px] uppercase font-black tracking-[0.2em] opacity-60 mb-1">TOTAL SCORE</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black italic tracking-tighter text-white">
                  {innings.runs}
                </span>
                <span className="text-3xl font-light opacity-50">/</span>
                <span className="text-3xl font-black italic text-red-400">
                  {innings.wickets}
                </span>
              </div>
              <p className="text-[10px] font-mono text-neutral-400 mt-1 uppercase">
                Overs Played: <span className="text-brand-emerald font-bold">{oversPlayed}.{ballsInOver}</span>
              </p>
            </div>

            {/* Partnership HUD and non-striker */}
            <div className="flex flex-col gap-2 justify-center flex-1">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-white/30" />
                <p className="text-xs font-bold text-neutral-300 uppercase tracking-wide">
                  Partnership: <span className="text-white text-sm font-mono font-black">{partnerRuns}</span> Runs <span className="text-neutral-500 font-mono">({partnerBalls} Balls)</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-emerald shadow-[0_0_8px_#00FF85]" />
                <p className="text-xs font-bold text-neutral-300 uppercase tracking-wide">
                  {nonActiveBatsman.player.name}: <span className="text-brand-emerald text-sm font-mono font-black">{nonActiveBatsman.runs}</span> Runs <span className="text-neutral-500 font-mono">({nonActiveBatsman.balls}b)</span>
                </p>
              </div>
            </div>

            {/* Run Rate Badge */}
            <div className="flex flex-col items-end justify-center bg-black/40 border border-white/10 px-4 py-2 rounded-lg text-right">
              <span className="text-[9px] uppercase tracking-wider text-neutral-400">Run Rate</span>
              <span className="text-xl font-black font-mono text-brand-emerald tracking-tight">{currentRR}</span>
            </div>
          </div>
        </div>

        {/* Right Col: Bowler Details & Ball Tracking */}
        <div className="bg-black/90 p-5 border-r-4 border-brand-emerald flex flex-col justify-between rounded-xl shadow-xl">
          
          {/* Header */}
          <div>
            <p className="text-[9px] uppercase tracking-widest opacity-50 font-black mb-1">CURRENT BOWLER</p>
            <h3 className="text-xl font-black italic uppercase text-white truncate">
              {innings.currentBowler.player.name}
            </h3>
            
            {/* Stats matrix */}
            <div className="grid grid-cols-4 gap-2 mt-3.5 border-t border-white/10 pt-3">
              <div className="text-left">
                <p className="text-[8px] uppercase tracking-wider opacity-40">Overs</p>
                <p className="text-base font-bold font-mono text-neutral-200">
                  {Math.floor(innings.currentBowler.balls / 6)}.{innings.currentBowler.balls % 6}
                </p>
              </div>
              <div className="text-left">
                <p className="text-[8px] uppercase tracking-wider opacity-40">Wkts</p>
                <p className="text-base font-black font-mono text-brand-emerald text-glow-emerald">
                  {innings.currentBowler.wickets}
                </p>
              </div>
              <div className="text-left">
                <p className="text-[8px] uppercase tracking-wider opacity-40">Runs</p>
                <p className="text-base font-bold font-mono text-neutral-200">
                  {innings.currentBowler.runs}
                </p>
              </div>
              <div className="text-left">
                <p className="text-[8px] uppercase tracking-wider opacity-40">Econ</p>
                <p className="text-base font-bold font-mono text-brand-sky">
                  {bowlerEcon}
                </p>
              </div>
            </div>
          </div>

          {/* Over-by-Over Ball Tracking HUD */}
          <div className="mt-5 border-t border-white/15 pt-3.5">
            <span className="text-[9px] font-black tracking-widest text-neutral-400 uppercase block mb-2">
              DELIVERY GRAPH
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
              {recentDeliveries.map((delivery, i) => {
                let ballStyle = 'border-white/20 text-white/70 bg-transparent';
                let label = delivery.runs.toString();

                if (delivery.isWicket) {
                  ballStyle = 'bg-red-600 text-white border-red-500 font-black shadow-[0_0_10px_rgba(239,68,68,0.5)]';
                  label = 'W';
                } else if (delivery.runs === 4) {
                  ballStyle = 'bg-brand-sky text-black border-brand-sky font-black shadow-[0_0_10px_rgba(0,163,255,0.4)]';
                  label = '4';
                } else if (delivery.runs === 6) {
                  ballStyle = 'bg-brand-emerald text-black border-brand-emerald font-black shadow-[0_0_12px_rgba(0,255,133,0.5)]';
                  label = '6';
                } else if (delivery.runs === 0) {
                  ballStyle = 'bg-white/10 text-neutral-400 border-white/10';
                  label = '•';
                }

                return (
                  <div 
                    key={i} 
                    className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-black transition-all ${ballStyle}`}
                    title={`Runs: ${delivery.runs}`}
                  >
                    {label}
                  </div>
                );
              })}
              {/* Pad remaining empty slots */}
              {Array.from({ length: Math.max(0, 6 - recentDeliveries.length) }).map((_, i) => (
                <div 
                  key={`empty-${i}`} 
                  className="w-7 h-7 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-neutral-600 text-xs font-bold opacity-30"
                >
                  -
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RRR Status banner for 2nd innings */}
      {isSecondInnings && innings.target && (
        <div className="w-full bg-[#0A0F0D] border border-brand-emerald/30 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-[0_0_15px_rgba(0,255,133,0.06)]">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-brand-emerald" />
            <span className="text-xs font-black tracking-wider uppercase">TARGET CHASE PROGRESSION</span>
          </div>
          <div className="text-sm font-bold uppercase">
            Need <span className="text-brand-emerald font-black text-base">{runsNeeded}</span> runs off{' '}
            <span className="text-brand-sky font-black text-base">{ballsRemaining}</span> balls remaining
          </div>
          <div className="bg-white/5 border border-white/10 px-3 py-1 rounded text-xs font-mono">
            Required RR: <span className="text-brand-emerald font-bold">{requiredRR}</span>
          </div>
        </div>
      )}
    </div>
  );
};
