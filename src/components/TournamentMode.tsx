import React, { useState, useEffect } from 'react';
import { Team, Tournament, TournamentFixture, TeamStanding } from '../types';
import { TEAMS } from '../lib/teamsData';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Star, ShieldAlert, Award, Play, ChevronRight, CheckCircle2, ListFilter, Users } from 'lucide-react';
import { audioEngine } from '../lib/audio';

interface TournamentModeProps {
  onBackToMenu: () => void;
  onPlayTournamentMatch: (
    userTeam: Team,
    opponentTeam: Team,
    overs: number,
    difficulty: 'easy' | 'medium' | 'hard',
    onComplete: (userWon: boolean, userScoreStr: string, opponentScoreStr: string) => void
  ) => void;
}

const PRESET_TOURNAMENTS = [
  {
    id: 'world_cup',
    type: 'world_cup' as const,
    name: 'T20 World Cup Championship',
    description: 'Lead your national side against the top six cricketing powerhouses. Features round-robin play leading to the grand final at Lord\'s.',
    teams: TEAMS,
    rounds: 5,
    overs: 2
  },
  {
    id: 'ashes',
    type: 'ashes' as const,
    name: 'The Ashes Series',
    description: 'The historic, ultimate clash of cricket supremacy. A grueling 3-match bilateral test series between Australia and England.',
    teams: TEAMS.filter(t => t.id === 'aus' || t.id === 'eng'),
    rounds: 3,
    overs: 5
  },
  {
    id: 't20_league',
    type: 't20_league' as const,
    name: 'T20 Franchise Premier League',
    description: 'Fast-paced domestic franchise league. Select your star-studded team and race to top the table and seize the gold.',
    teams: TEAMS,
    rounds: 4,
    overs: 1 // Blitz 1 over
  }
];

export const TournamentMode: React.FC<TournamentModeProps> = ({ onBackToMenu, onPlayTournamentMatch }) => {
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState('world_cup');
  const [userTeamId, setUserTeamId] = useState('ind');

  // Load active tournament on mount
  useEffect(() => {
    const saved = localStorage.getItem('cricket_c24_tournament');
    if (saved) {
      try {
        setActiveTournament(JSON.parse(saved));
      } catch (e) {
        console.warn('Failed parsing tournament save', e);
      }
    }
  }, []);

  const handleSaveTournament = (tourney: Tournament | null) => {
    setActiveTournament(tourney);
    if (tourney) {
      localStorage.setItem('cricket_c24_tournament', JSON.stringify(tourney));
    } else {
      localStorage.removeItem('cricket_c24_tournament');
    }
  };

  const handleCreateTournament = () => {
    const preset = PRESET_TOURNAMENTS.find(p => p.id === selectedPresetId);
    if (!preset) return;

    // Ensure the team lists contain the user team
    const teams = preset.teams;
    if (!teams.some(t => t.id === userTeamId) && preset.type !== 'ashes') {
      alert('Selected team is not part of this tournament.');
      return;
    }

    // Initialize Standings
    const standings: TeamStanding[] = teams.map(t => ({
      teamId: t.id,
      teamName: t.name,
      flagEmoji: t.flagEmoji,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      netRunRate: 0
    }));

    // Generate Fixtures (Round Robin scheduling)
    const fixtures: TournamentFixture[] = [];
    let fixtureCounter = 1;

    // Generate rounds
    for (let r = 1; r <= preset.rounds; r++) {
      // Create pairs
      const playedThisRound = new Set<string>();
      
      teams.forEach((t1) => {
        teams.forEach((t2) => {
          if (t1.id === t2.id) return;
          const pairKey = [t1.id, t2.id].sort().join('-');
          if (playedThisRound.has(pairKey)) return;

          // Only schedule a subset of matches depending on the preset
          if (preset.type === 'ashes') {
            fixtures.push({
              id: `f_ashes_${r}`,
              round: r,
              team1Id: 'aus',
              team2Id: 'eng',
              isPlayed: false
            });
            playedThisRound.add(pairKey);
          } else {
            // World Cup or Franchise League
            // Distribute matches so everyone plays in rounds
            const matchesInThisRound = fixtures.filter(f => f.round === r).length;
            if (matchesInThisRound < Math.floor(teams.length / 2)) {
              if (!fixtures.some(f => f.round === r && (f.team1Id === t1.id || f.team2Id === t1.id || f.team1Id === t2.id || f.team2Id === t2.id))) {
                fixtures.push({
                  id: `f_${preset.id}_r${r}_m${fixtureCounter++}`,
                  round: r,
                  team1Id: t1.id,
                  team2Id: t2.id,
                  isPlayed: false
                });
                playedThisRound.add(pairKey);
              }
            }
          }
        });
      });
    }

    const newTourney: Tournament = {
      id: `${preset.id}_${Date.now()}`,
      type: preset.type,
      name: preset.name,
      userTeamId,
      teams,
      fixtures,
      standings,
      currentRound: 1,
      isCompleted: false,
      wonTrophy: false
    };

    handleSaveTournament(newTourney);
    audioEngine.playBoundaryCheer();
  };

  const handlePlayNextMatch = (fixture: TournamentFixture) => {
    if (!activeTournament) return;

    const userTeam = activeTournament.teams.find(t => t.id === activeTournament.userTeamId)!;
    const oppTeamId = fixture.team1Id === userTeam.id ? fixture.team2Id : fixture.team1Id;
    const opponentTeam = activeTournament.teams.find(t => t.id === oppTeamId)!;

    const preset = PRESET_TOURNAMENTS.find(p => p.type === activeTournament.type)!;

    onPlayTournamentMatch(
      userTeam,
      opponentTeam,
      preset.overs,
      'medium',
      (userWon, userScoreStr, opponentScoreStr) => {
        // Complete current fixture
        let updatedFixtures = activeTournament.fixtures.map(f => {
          if (f.id === fixture.id) {
            return {
              ...f,
              score1: fixture.team1Id === userTeam.id ? userScoreStr : opponentScoreStr,
              score2: fixture.team1Id === userTeam.id ? opponentScoreStr : userScoreStr,
              winnerId: userWon ? userTeam.id : opponentTeam.id,
              isPlayed: true
            };
          }
          return f;
        });

        // Simulate other fixtures in this round automatically!
        updatedFixtures = updatedFixtures.map(f => {
          if (f.round === activeTournament.currentRound && !f.isPlayed) {
            const rRuns1 = Math.floor(Math.random() * 40) + 15;
            const rRuns2 = Math.floor(Math.random() * 40) + 15;
            const rWickets1 = Math.floor(Math.random() * 5);
            const rWickets2 = Math.floor(Math.random() * 5);
            const winner = rRuns1 >= rRuns2 ? f.team1Id : f.team2Id;

            return {
              ...f,
              score1: `${rRuns1}/${rWickets1}`,
              score2: `${rRuns2}/${rWickets2}`,
              winnerId: winner,
              isPlayed: true
            };
          }
          return f;
        });

        // Recalculate standings table
        const standingsMap = new Map<string, TeamStanding>();
        activeTournament.standings.forEach(s => {
          standingsMap.set(s.teamId, { ...s, played: 0, won: 0, lost: 0, points: 0, netRunRate: 0 });
        });

        updatedFixtures.forEach(f => {
          if (!f.isPlayed || !f.winnerId) return;

          const s1 = standingsMap.get(f.team1Id)!;
          const s2 = standingsMap.get(f.team2Id)!;

          s1.played += 1;
          s2.played += 1;

          if (f.winnerId === f.team1Id) {
            s1.won += 1;
            s1.points += 2;
            s2.lost += 1;
          } else {
            s2.won += 1;
            s2.points += 2;
            s1.lost += 1;
          }

          // Random nice NRR simulation
          s1.netRunRate += f.winnerId === f.team1Id ? 1.5 : -1.5;
          s2.netRunRate += f.winnerId === f.team2Id ? 1.5 : -1.5;
        });

        const updatedStandings = Array.from(standingsMap.values()).sort((a, b) => b.points - a.points || b.netRunRate - a.netRunRate);

        // Check if all rounds are finished
        const nextRound = activeTournament.currentRound + 1;
        const totalRounds = preset.rounds;
        const isCompleted = nextRound > totalRounds;

        // User won trophy check
        let wonTrophy = false;
        if (isCompleted) {
          // If ashes, check if user team won more matches
          if (activeTournament.type === 'ashes') {
            const wins = updatedFixtures.filter(f => f.winnerId === userTeam.id).length;
            wonTrophy = wins >= 2;
          } else {
            // Franchise or world cup: check if user is Top 1 in standings
            wonTrophy = updatedStandings[0].teamId === userTeam.id;
          }
        }

        const nextTournamentState: Tournament = {
          ...activeTournament,
          fixtures: updatedFixtures,
          standings: updatedStandings,
          currentRound: isCompleted ? activeTournament.currentRound : nextRound,
          isCompleted,
          wonTrophy
        };

        handleSaveTournament(nextTournamentState);
        audioEngine.playBoundaryCheer();
      }
    );
  };

  const abandonTournament = () => {
    if (window.confirm('Are you sure you want to retire from this tournament? Your progress will be lost.')) {
      handleSaveTournament(null);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 font-sans text-white p-2" id="tournament-mode-lobby">
      
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-sky to-brand-emerald flex items-center justify-center text-black font-black">
            <Trophy size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">TOURNAMENT <span className="text-brand-sky text-glow-sky">CHAMPIONSHIP</span></h1>
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Compete against legendary AI teams to earn global cup glory</p>
          </div>
        </div>
        <button
          onClick={onBackToMenu}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-black uppercase tracking-wider transition"
        >
          Exit to Menu
        </button>
      </div>

      <AnimatePresence mode="wait">
        {!activeTournament ? (
          /* Selection Screen */
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left Col: Preset Selection */}
            <div className="lg:col-span-2 bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-2xl flex flex-col gap-4">
              <span className="text-[10px] font-black text-brand-sky tracking-widest uppercase block border-b border-white/10 pb-2">
                SELECT A TOURNAMENT FORMAT
              </span>

              <div className="flex flex-col gap-3">
                {PRESET_TOURNAMENTS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPresetId(p.id);
                      if (p.type === 'ashes') {
                        setUserTeamId('aus'); // Default Ashes team
                      }
                    }}
                    className={`p-4 rounded-xl border text-left flex items-start gap-4 transition duration-150 ${
                      selectedPresetId === p.id 
                        ? 'bg-brand-sky/5 border-brand-sky/40 shadow-[0_0_15px_rgba(0,186,255,0.1)]' 
                        : 'bg-black/40 border-white/5 hover:border-white/15'
                    }`}
                  >
                    <span className="text-2xl p-2 bg-black/60 rounded-lg">🏆</span>
                    <div>
                      <h3 className="text-sm font-black uppercase text-neutral-100">{p.name}</h3>
                      <p className="text-xs text-neutral-400 font-medium leading-relaxed mt-1">{p.description}</p>
                      
                      <div className="flex gap-4 mt-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                        <span>Format: <strong className="text-neutral-300">{p.rounds} Rounds</strong></span>
                        <span>Overs: <strong className="text-neutral-300">{p.overs} overs</strong></span>
                        <span>Teams: <strong className="text-neutral-300">{p.teams.length} Sides</strong></span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Col: Team Choice & Start */}
            <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-2xl flex flex-col justify-between">
              <div className="flex flex-col gap-4">
                <span className="text-[10px] font-black text-brand-emerald tracking-widest uppercase block border-b border-white/10 pb-2">
                  CHOOSE YOUR SQUAD
                </span>

                {selectedPresetId === 'ashes' ? (
                  <div className="bg-black/60 p-4 border border-white/10 rounded-xl">
                    <label className="text-[10px] uppercase font-black text-neutral-400 block mb-2">Ashes National Franchise</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['aus', 'eng'].map((tid) => {
                        const t = TEAMS.find(x => x.id === tid)!;
                        return (
                          <button
                            key={tid}
                            onClick={() => setUserTeamId(tid)}
                            className={`p-3 rounded-lg border flex items-center justify-center gap-2 text-xs font-black uppercase transition ${
                              userTeamId === tid 
                                ? 'bg-brand-sky border-brand-sky text-black' 
                                : 'bg-black/40 border-white/5 hover:border-white/15'
                            }`}
                          >
                            <span className="text-xl">{t.flagEmoji}</span> {t.shortName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/60 p-4 border border-white/10 rounded-xl">
                    <label className="text-[10px] uppercase font-black text-neutral-400 block mb-2">Tournament Team</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {TEAMS.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setUserTeamId(t.id)}
                          className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 text-[10px] font-black uppercase transition ${
                            userTeamId === t.id 
                              ? 'bg-brand-sky border-brand-sky text-black' 
                              : 'bg-black/40 border-white/5 hover:border-white/15'
                          }`}
                        >
                          <span className="text-xl">{t.flagEmoji}</span>
                          <span>{t.shortName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleCreateTournament}
                className="w-full py-3.5 bg-gradient-to-r from-brand-sky to-brand-emerald hover:opacity-95 text-black font-black uppercase text-xs tracking-widest rounded-xl mt-6 shadow-[0_0_15px_rgba(0,186,255,0.25)] flex items-center justify-center gap-2 transform active:scale-95 transition"
              >
                <Trophy size={14} /> Start Championship Campaign
              </button>
            </div>
          </motion.div>
        ) : (
          /* Tournament Dashboard Screen */
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            
            {/* Left Column: Points Standing Table */}
            <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-2xl flex flex-col gap-4">
              <span className="text-[10px] font-black text-brand-sky tracking-widest uppercase block border-b border-white/10 pb-2">
                STANDINGS & POINTS TABLE
              </span>

              <div className="w-full overflow-hidden border border-white/5 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-black/40 text-[9px] uppercase font-black text-neutral-400 border-b border-white/10">
                      <th className="p-2.5">Team</th>
                      <th className="p-2.5 text-center">P</th>
                      <th className="p-2.5 text-center">W</th>
                      <th className="p-2.5 text-center">L</th>
                      <th className="p-2.5 text-center">NRR</th>
                      <th className="p-2.5 text-center text-brand-sky">PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTournament.standings.map((team, idx) => (
                      <tr 
                        key={team.teamId} 
                        className={`border-b border-white/5 hover:bg-white/5 transition ${
                          team.teamId === activeTournament.userTeamId ? 'bg-brand-sky/5 font-black' : ''
                        }`}
                      >
                        <td className="p-2.5 flex items-center gap-2">
                          <span className="font-mono text-[9px] text-neutral-500">#{idx + 1}</span>
                          <span className="text-sm">{team.flagEmoji}</span>
                          <span className="truncate max-w-[80px]">{team.teamName}</span>
                        </td>
                        <td className="p-2.5 text-center font-mono">{team.played}</td>
                        <td className="p-2.5 text-center font-mono text-brand-emerald">{team.won}</td>
                        <td className="p-2.5 text-center font-mono text-red-400">{team.lost}</td>
                        <td className="p-2.5 text-center font-mono text-neutral-400">{team.netRunRate > 0 ? '+' : ''}{team.netRunRate.toFixed(1)}</td>
                        <td className="p-2.5 text-center font-mono font-black text-brand-sky">{team.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 bg-black/40 border border-white/5 p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-neutral-500 uppercase block">Active Campaign</span>
                  <span className="text-xs font-black uppercase text-neutral-300">{activeTournament.name}</span>
                </div>
                <button
                  onClick={abandonTournament}
                  className="px-3 py-1.5 border border-red-500/20 text-red-400 hover:bg-red-500/10 text-[10px] font-black uppercase tracking-wider rounded-lg transition"
                >
                  Abandon
                </button>
              </div>
            </div>

            {/* Right Column: Fixtures / Round Progress & Play */}
            <div className="lg:col-span-2 flex flex-col gap-6">

              {/* Tournament Progress banner */}
              <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black text-brand-emerald tracking-widest uppercase block">CAMPAIGN PROGRESSION</span>
                  <h3 className="text-lg font-black uppercase text-neutral-100 mt-1">
                    {activeTournament.isCompleted 
                      ? 'Tournament Completed!' 
                      : `Round ${activeTournament.currentRound} of ${PRESET_TOURNAMENTS.find(p => p.type === activeTournament.type)?.rounds}`}
                  </h3>
                </div>
                <div className="w-12 h-12 bg-brand-sky/10 border border-brand-sky/20 text-brand-sky rounded-full flex items-center justify-center font-black">
                  {activeTournament.isCompleted ? '✓' : `${activeTournament.currentRound}`}
                </div>
              </div>

              {/* Trophy Hoist Screen if completed */}
              {activeTournament.isCompleted && (
                <div className="bg-gradient-to-tr from-brand-sky/20 to-brand-emerald/10 border border-brand-sky p-8 rounded-2xl text-center flex flex-col items-center gap-4 shadow-[0_0_25px_rgba(0,186,255,0.15)] animate-pulse">
                  <div className="text-6xl animate-bounce">🏆</div>
                  <div>
                    <h2 className="text-2xl font-black italic tracking-tighter uppercase">
                      {activeTournament.wonTrophy ? 'CAMPIGN COMPLETED: CHAMPIONS!' : 'CAMPAIGN COMPLETED'}
                    </h2>
                    <p className="text-xs text-neutral-300 font-medium leading-relaxed mt-2 max-w-md mx-auto">
                      {activeTournament.wonTrophy 
                        ? 'An incredible performance! Your team has stood the test of endurance, out-battled the world\'s finest, and hoisted the championship silver!' 
                        : 'You fought hard, but finished outside the trophy position. Retire and start a new campaign to conquer the stadium!'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleSaveTournament(null)}
                    className="px-6 py-3 bg-brand-sky hover:bg-brand-sky/90 text-black font-black uppercase text-xs tracking-widest rounded-xl transition shadow-[0_0_10px_rgba(0,186,255,0.3)]"
                  >
                    Start New Campaign
                  </button>
                </div>
              )}

              {/* Fixtures list */}
              {!activeTournament.isCompleted && (
                <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-xl flex flex-col gap-4">
                  <span className="text-[10px] font-black text-white tracking-widest uppercase block border-b border-white/10 pb-2">
                    ACTIVE ROUND FIXTURES
                  </span>

                  <div className="flex flex-col gap-3">
                    {activeTournament.fixtures
                      .filter(f => f.round === activeTournament.currentRound)
                      .map((fixture) => {
                        const t1 = activeTournament.teams.find(t => t.id === fixture.team1Id)!;
                        const t2 = activeTournament.teams.find(t => t.id === fixture.team2Id)!;
                        const isUserMatch = fixture.team1Id === activeTournament.userTeamId || fixture.team2Id === activeTournament.userTeamId;

                        return (
                          <div 
                            key={fixture.id} 
                            className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 transition duration-150 ${
                              isUserMatch 
                                ? 'bg-brand-sky/5 border-brand-sky/20' 
                                : 'bg-black/40 border-white/5'
                            }`}
                          >
                            {/* Match core info */}
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1.5 font-bold">
                                <span className="text-lg">{t1.flagEmoji}</span>
                                <span className="text-xs uppercase text-neutral-300">{t1.shortName}</span>
                              </div>
                              <span className="text-[10px] font-black text-neutral-500">VS</span>
                              <div className="flex items-center gap-1.5 font-bold">
                                <span className="text-lg">{t2.flagEmoji}</span>
                                <span className="text-xs uppercase text-neutral-300">{t2.shortName}</span>
                              </div>
                            </div>

                            {/* Scores or Action Button */}
                            <div className="flex items-center gap-4">
                              {fixture.isPlayed ? (
                                <div className="text-right">
                                  <span className="text-[10px] text-neutral-400 block font-bold uppercase">Result</span>
                                  <span className="text-xs font-black text-brand-emerald">
                                    {fixture.score1} vs {fixture.score2}
                                  </span>
                                </div>
                              ) : isUserMatch ? (
                                <button
                                  onClick={() => handlePlayNextMatch(fixture)}
                                  className="px-4 py-2 bg-gradient-to-r from-brand-sky to-brand-emerald hover:opacity-95 text-black font-black text-xs uppercase tracking-widest rounded-xl flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,186,255,0.25)] transition"
                                >
                                  Play Match <Play size={11} fill="black" />
                                </button>
                              ) : (
                                <span className="text-[10px] font-black bg-white/5 px-2.5 py-1 rounded text-neutral-400 uppercase tracking-wider">
                                  Auto Simulates
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
