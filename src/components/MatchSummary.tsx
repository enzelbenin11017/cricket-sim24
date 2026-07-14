import React, { useEffect, useRef } from 'react';
import { Team, Innings, BallHistory } from '../types';
import { Trophy, RefreshCw, BarChart2, Star, Calendar, MapPin } from 'lucide-react';
import { audioEngine } from '../lib/audio';

interface MatchSummaryProps {
  userTeam: Team;
  opponentTeam: Team;
  innings1: Innings;
  innings2: Innings;
  userBatsFirst: boolean;
  onPlayAgain: () => void;
}

export const MatchSummary: React.FC<MatchSummaryProps> = ({
  userTeam,
  opponentTeam,
  innings1,
  innings2,
  userBatsFirst,
  onPlayAgain
}) => {
  const pitchMapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wagonWheelCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Match outcome math
  const runs1 = innings1.runs;
  const runs2 = innings2.runs;
  const wickets2 = innings2.wickets;

  const team1 = userBatsFirst ? userTeam : opponentTeam;
  const team2 = userBatsFirst ? opponentTeam : userTeam;

  const hasChaserWon = runs2 >= innings1.target!;
  const winnerTeam = hasChaserWon ? team2 : team1;

  let resultString = '';
  if (hasChaserWon) {
    const wicketsLeft = 10 - wickets2;
    resultString = `${winnerTeam.name} won by ${wicketsLeft} wicket${wicketsLeft > 1 ? 's' : ''}!`;
  } else {
    const runsDefended = runs1 - runs2;
    resultString = `${winnerTeam.name} won by ${runsDefended} run${runsDefended > 1 ? 's' : ''}!`;
  }

  // Trigger win crowd sound
  useEffect(() => {
    audioEngine.playBoundaryCheer();
  }, []);

  // Collect all deliveries to map bounce and hit directions
  const allDeliveries: BallHistory[] = [
    ...innings1.oversHistory.flat(),
    ...innings1.currentOver,
    ...innings2.oversHistory.flat(),
    ...innings2.currentOver
  ];

  // Draw Pitch Map Canvas (Styled to fit the Artistic Flair palette)
  useEffect(() => {
    const canvas = pitchMapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width = 180;
    const h = canvas.height = 240;

    // Draw clay pitch with custom aesthetic border
    ctx.fillStyle = '#081C15'; // Dark slate backing
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1e2d24'; // Mud clay
    ctx.fillRect(15, 15, w - 30, h - 30);

    // Draw crease lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(15, 45); // bowler end crease
    ctx.lineTo(w - 15, 45);
    ctx.moveTo(15, h - 45); // batsman end crease
    ctx.lineTo(w - 15, h - 45);
    ctx.stroke();

    // Group markings
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'black 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BOWLER END', w / 2, 10);
    ctx.fillText('STRIKER CREASE', w / 2, h - 6);

    // Draw stumps
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 6, 15); ctx.lineTo(w / 2 + 6, 15); // Bowler stumps
    ctx.moveTo(w / 2 - 6, h - 15); ctx.lineTo(w / 2 + 6, h - 15); // Batsman stumps
    ctx.stroke();

    // Map each pitch point
    allDeliveries.forEach(ball => {
      if (ball.pitchX === undefined || ball.pitchY === undefined) return;

      // Map scale: Pitch width is -1.5m to 1.5m, Pitch length is 0m to 20.12m
      const pitchWidthPixels = w - 30;
      const pitchHeightPixels = h - 90;

      const px = 15 + ((ball.pitchX + 1.5) / 3.0) * pitchWidthPixels;
      const py = 45 + (ball.pitchY / 20.12) * pitchHeightPixels;

      // Color code based on landing length (Artistic Flair Palette)
      let color = '#00A3FF'; // Brand Sky Blue for Good length
      if (ball.pitchY <= 8) {
        color = '#ef4444'; // Red for short length
      } else if (ball.pitchY >= 17) {
        color = '#00FF85'; // Brand Emerald for Yorker/Full length
      } else if (ball.pitchY >= 14 && ball.pitchY < 17) {
        color = '#00A3FF'; // Sky for good length
      }

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    });
  }, [allDeliveries]);

  // Draw Wagon Wheel Canvas
  useEffect(() => {
    const canvas = wagonWheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width = 240;
    const h = canvas.height = 240;
    const cx = w / 2;
    const cy = h / 2;
    const radius = 95;

    // Outer boundary green
    ctx.fillStyle = '#081C15';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Outer rope
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Radial grids
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.7, 0, Math.PI * 2);
    ctx.arc(cx, cy, radius * 0.4, 0, Math.PI * 2);
    ctx.stroke();

    // Draw pitch center
    ctx.fillStyle = '#1e2d24';
    ctx.fillRect(cx - 3, cy - 12, 6, 24);

    // Render shot lines
    allDeliveries.forEach(ball => {
      if (ball.shotAngle === undefined) return;

      const rads = (ball.shotAngle - 90) * Math.PI / 180;
      const hitDistFraction = Math.min(1.0, (ball.shotDistance || 40) / 90);
      
      const targetX = cx + Math.cos(rads) * (radius * hitDistFraction);
      const targetY = cy + Math.sin(rads) * (radius * hitDistFraction);

      // Color coding shot lines (Artistic Flair Palette)
      let lineColor = 'rgba(255, 255, 255, 0.35)'; // single runs
      let width = 1;
      if (ball.runs === 4) {
        lineColor = '#00A3FF'; // Brand Sky Blue for fours
        width = 2.5;
      } else if (ball.runs === 6) {
        lineColor = '#00FF85'; // Brand Emerald for sixes
        width = 4;
      }

      ctx.strokeStyle = lineColor;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();

      // Small ending node
      ctx.fillStyle = ball.runs >= 4 ? '#ffffff' : 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(targetX, targetY, ball.runs === 6 ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Label boundaries
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'black 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('OFFSIDE', cx - 50, cy + 4);
    ctx.fillText('LEGSIDE', cx + 50, cy + 4);
  }, [allDeliveries]);

  // Combine batsmen stats from both innings
  const getBatsmanLeaderboard = () => {
    const list = [];
    [innings1, innings2].forEach((inn, innIdx) => {
      const team = innIdx === 0 ? team1 : team2;
      list.push({
        teamEmoji: team.flagEmoji,
        teamName: team.shortName,
        player: inn.batsman1.player,
        runs: inn.batsman1.runs,
        balls: inn.batsman1.balls,
        fours: inn.batsman1.fours,
        sixes: inn.batsman1.sixes,
        isOut: inn.batsman1.isOut,
        outReason: inn.batsman1.outReason
      });
      list.push({
        teamEmoji: team.flagEmoji,
        teamName: team.shortName,
        player: inn.batsman2.player,
        runs: inn.batsman2.runs,
        balls: inn.batsman2.balls,
        fours: inn.batsman2.fours,
        sixes: inn.batsman2.sixes,
        isOut: inn.batsman2.isOut,
        outReason: inn.batsman2.outReason
      });
    });
    return list.sort((a, b) => b.runs - a.runs);
  };

  const getBowlerLeaderboard = () => {
    const list = [];
    [innings1, innings2].forEach((inn, innIdx) => {
      const team = innIdx === 0 ? team2 : team1; // bowler belongs to bowling team
      list.push({
        teamEmoji: team.flagEmoji,
        teamName: team.shortName,
        player: inn.currentBowler.player,
        overs: `${Math.floor(inn.currentBowler.balls / 6)}.${inn.currentBowler.balls % 6}`,
        runs: inn.currentBowler.runs,
        wickets: inn.currentBowler.wickets
      });
    });
    return list;
  };

  const batsmenLeaderboard = getBatsmanLeaderboard();
  const bowlerLeaderboard = getBowlerLeaderboard();

  return (
    <div className="w-full flex flex-col gap-6 font-sans text-white p-2" id="match-summary-board">
      
      {/* Huge Championship Podium Banner */}
      <div className="relative overflow-hidden bg-[#0A0F0D]/90 border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center text-center shadow-2xl backdrop-blur-md">
        <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-brand-emerald via-brand-sky to-brand-emerald" />
        
        <div className="w-16 h-16 rounded-full bg-brand-emerald/10 border border-brand-emerald/40 flex items-center justify-center text-brand-emerald mb-3.5 shadow-lg shadow-brand-emerald/10">
          <Trophy size={32} className="animate-pulse" />
        </div>
        
        <h2 className="text-xs md:text-sm font-black text-brand-emerald uppercase tracking-widest leading-none">
          Championship Match Completed
        </h2>
        <h1 className="text-3xl md:text-5xl font-black italic uppercase mt-2.5 text-white tracking-tighter leading-none">
          {resultString}
        </h1>
        <p className="text-neutral-400 text-[10px] uppercase font-bold tracking-widest mt-3.5 flex items-center gap-1.5 bg-white/5 border border-white/10 px-3 py-1 rounded">
          <Calendar size={12} className="text-brand-emerald" /> LORDS CRICKET ARENA SIMULATOR • DAY SESSION 5
        </p>
      </div>

      {/* Analytics Bento Grid (Wagon Wheel & Pitch Map) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Wagon Wheel Container */}
        <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-xl flex flex-col items-center justify-between">
          <h3 className="text-xs font-black text-white flex items-center gap-2 uppercase tracking-widest mb-4 border-b border-white/10 pb-2.5 w-full">
            <BarChart2 size={14} className="text-brand-emerald" /> BROADCAST WAGON WHEEL
          </h3>
          <canvas ref={wagonWheelCanvasRef} className="rounded-full shadow-2xl border border-white/10" />
          <div className="flex gap-4 mt-5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-white/40 inline-block rounded-sm" /> Singles</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-brand-sky inline-block rounded-sm" /> Fours</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 bg-brand-emerald inline-block rounded-sm" /> Sixes</span>
          </div>
        </div>

        {/* Pitch Map Container */}
        <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-xl flex flex-col items-center justify-between">
          <h3 className="text-xs font-black text-white flex items-center gap-2 uppercase tracking-widest mb-4 border-b border-white/10 pb-2.5 w-full">
            <BarChart2 size={14} className="text-brand-sky" /> BOWLING PITCH MAP
          </h3>
          <canvas ref={pitchMapCanvasRef} className="rounded-lg shadow-2xl border border-white/10" />
          <div className="flex gap-4 mt-5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-500 inline-block rounded-full" /> Short Ball</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-brand-sky inline-block rounded-full" /> Good Length</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-brand-emerald inline-block rounded-full" /> Yorker / Full</span>
          </div>
        </div>
      </div>

      {/* Scorecards Leadboard Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Batsmen score card */}
        <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-xl">
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-3.5 border-b border-white/10 pb-2.5 flex items-center justify-between">
            <span>BATTING SCORECARD</span>
            <span className="text-[10px] text-neutral-400 font-mono tracking-wider">STRIKE RATE</span>
          </h3>
          <div className="flex flex-col gap-2.5">
            {batsmenLeaderboard.map((item, idx) => {
              const sr = item.balls > 0 ? ((item.runs / item.balls) * 100).toFixed(1) : '0.0';
              return (
                <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl bg-black/40 border border-white/5 hover:border-white/15 transition duration-150">
                  <div className="flex items-center gap-3">
                    <span className="text-lg" title={item.teamName}>{item.teamEmoji}</span>
                    <div>
                      <span className="font-black italic uppercase text-sm block text-neutral-100">{item.player.name}</span>
                      <span className="text-[9px] text-neutral-400 uppercase font-bold tracking-wider">{item.isOut ? (item.outReason || 'Out') : 'Not Out'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-base font-black text-brand-emerald font-mono">{item.runs}</span>
                      <span className="text-[10px] text-neutral-400 ml-1">({item.balls})</span>
                    </div>
                    <div className="text-[10px] font-black text-neutral-300 font-mono bg-white/5 border border-white/10 px-2.5 py-1 rounded w-18 text-center uppercase tracking-wider">
                      SR: {sr}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bowler score card */}
        <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-xl">
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-3.5 border-b border-white/10 pb-2.5 flex items-center justify-between">
            <span>BOWLER SPELLS ANALYSIS</span>
            <span className="text-[10px] text-neutral-400 font-mono tracking-wider">WKTS - RUNS</span>
          </h3>
          <div className="flex flex-col gap-2.5">
            {bowlerLeaderboard.map((item, idx) => {
              const econ = parseFloat(item.overs) > 0 ? (item.runs / parseFloat(item.overs)).toFixed(2) : '0.00';
              return (
                <div key={idx} className="flex items-center justify-between p-3.5 rounded-xl bg-black/40 border border-white/5 hover:border-white/15 transition duration-150">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{item.teamEmoji}</span>
                    <div>
                      <span className="font-black italic uppercase text-sm block text-neutral-100">{item.player.name}</span>
                      <span className="text-[9px] text-brand-sky uppercase font-bold tracking-wider">Bowler Spell</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-base font-black text-red-400 font-mono">{item.wickets}</span>
                      <span className="text-[10px] text-neutral-400 font-bold uppercase ml-1">w</span>
                      <span className="text-xs text-neutral-600 ml-1.5">/</span>
                      <span className="text-base font-black text-neutral-200 font-mono ml-1.5">{item.runs}</span>
                      <span className="text-[10px] text-neutral-400 font-bold uppercase ml-1">r</span>
                    </div>
                    <div className="text-[10px] font-black text-neutral-300 font-mono bg-white/5 border border-white/10 px-2.5 py-1 rounded">
                      Econ: {econ}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Big Action Call Button */}
      <button
        onClick={onPlayAgain}
        className="w-full mt-4 py-3.5 bg-gradient-to-r from-brand-emerald via-brand-sky to-brand-emerald hover:opacity-95 text-black font-black uppercase rounded-2xl tracking-widest flex items-center justify-center gap-2 transition transform active:scale-95 shadow-[0_0_20px_rgba(0,255,133,0.35)] text-sm"
      >
        <RefreshCw size={14} /> Play Another Match
      </button>
    </div>
  );
};
