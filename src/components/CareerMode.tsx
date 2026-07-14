import React, { useState, useEffect } from 'react';
import { Team, Player, CareerProfile, CustomCricketer } from '../types';
import { TEAMS } from '../lib/teamsData';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Award, Trophy, ShieldAlert, Sparkles, Plus, Minus, 
  RotateCcw, BookOpen, Dumbbell, Zap, Play, CheckCircle2, ChevronRight 
} from 'lucide-react';
import { audioEngine } from '../lib/audio';

interface CareerModeProps {
  onBackToMenu: () => void;
  onPlayCareerMatch: (
    userTeam: Team,
    opponentTeam: Team,
    overs: number,
    difficulty: 'easy' | 'medium' | 'hard',
    onComplete: (runs: number, wickets: number) => void
  ) => void;
}

const SKIN_TONES = [
  { label: 'Fair', value: '#F5CBA7' },
  { label: 'Olive', value: '#E59866' },
  { label: 'Tan', value: '#D35400' },
  { label: 'Brown', value: '#873600' },
  { label: 'Dark Brown', value: '#5D4037' }
];

const HAIR_STYLES = ['Short', 'Spiky', 'Long', 'Bald'] as const;

const HAIR_COLORS = [
  { name: 'Black', value: '#1A1A1A' },
  { name: 'Brown', value: '#4A3B32' },
  { name: 'Blonde', value: '#F4D03F' },
  { name: 'Saffron', value: '#E67E22' }
];

const BAT_BRANDS = ['Kookaburra', 'MRF', 'Gray-Nicolls', 'Spartan'];

const CAREER_LEVELS = [
  { level: 1, name: 'State Club Academy', matchTitle: 'Lords Academy Shield', matches: ['Academy XI', 'Lords Club', 'Grassroots CC'], reward: 150 },
  { level: 2, name: 'National Domestic League', matchTitle: 'Ranji Trophy / BBL Cup', matches: ['Mumbai Stallions', 'NSW Blues', 'Yorkshire Falcons'], reward: 350 },
  { level: 3, name: 'International Captaincy', matchTitle: 'T20 Bilateral Championship', matches: ['Australia', 'England', 'New Zealand'], reward: 800 },
  { level: 4, name: 'World Series Legend', matchTitle: 'Global Legends Final', matches: ['World XI', 'Rival Nations Match', 'Lord\'s Invitation XI'], reward: 1800 }
];

const CAREER_DECISIONS = [
  {
    id: 'decision_sponsorship',
    title: 'Brand Endorsement Offer',
    description: 'A major cricket sports brand wants you to sign a contract to use their bat. It comes with custom-crafted gear but requires heavy promotional schedules.',
    optionA: {
      label: 'Sign Lucrative Deal',
      outcome: 'Gain 800 Credits and +15 Fame, but lose 15 Stamina from long PR events.',
      effect: (p: CareerProfile): CareerProfile => ({
        ...p,
        credits: p.credits + 800,
        fame: p.fame + 15,
        stamina: Math.max(0, p.stamina - 15),
        customCricketer: { ...p.customCricketer, batBrand: 'MRF' }
      })
    },
    optionB: {
      label: 'Refuse & Focus on Training',
      outcome: 'Gain +10 Training Points and +5 Timings stats as you focus in the nets.',
      effect: (p: CareerProfile): CareerProfile => ({
        ...p,
        trainingPoints: p.trainingPoints + 10,
        customCricketer: {
          ...p.customCricketer,
          stats: {
            ...p.customCricketer.stats,
            timing: Math.min(99, p.customCricketer.stats.timing + 5)
          }
        }
      })
    }
  },
  {
    id: 'decision_coach',
    title: 'Apologize to the Gaffer',
    description: 'The Head Coach is frustrated with your recent media statements. You can stand your ground or apologize in front of the playing roster.',
    optionA: {
      label: 'Apologize to Team',
      outcome: 'Gain Coach trust: +10 Fame, and +5 Control stats, but lose -5 Batting Power due to morale hit.',
      effect: (p: CareerProfile): CareerProfile => ({
        ...p,
        fame: p.fame + 10,
        customCricketer: {
          ...p.customCricketer,
          stats: {
            ...p.customCricketer.stats,
            control: Math.min(99, p.customCricketer.stats.control + 5),
            battingPower: Math.max(35, p.customCricketer.stats.battingPower - 5)
          }
        }
      })
    },
    optionB: {
      label: 'Express Self Confidence',
      outcome: 'Player morale boosts: +10 Batting Power and +5 running speed, but lose 10 Fame with national selectors.',
      effect: (p: CareerProfile): CareerProfile => ({
        ...p,
        fame: Math.max(0, p.fame - 10),
        customCricketer: {
          ...p.customCricketer,
          stats: {
            ...p.customCricketer.stats,
            battingPower: Math.min(99, p.customCricketer.stats.battingPower + 10),
            runningSpeed: Math.min(99, p.customCricketer.stats.runningSpeed + 5)
          }
        }
      })
    }
  },
  {
    id: 'decision_fitness',
    title: 'High Altitude Camp',
    description: 'National fitness scouts invite you to a high-altitude recovery and athletic training camp. It is expensive but optimizes your body.',
    optionA: {
      label: 'Pay for Elite Camp',
      outcome: 'Costs 400 Credits. Gain +15 Training Points, +5 Running Speed, and set Stamina to 100.',
      effect: (p: CareerProfile): CareerProfile => {
        if (p.credits < 400) return p;
        return {
          ...p,
          credits: p.credits - 400,
          trainingPoints: p.trainingPoints + 15,
          stamina: 100,
          customCricketer: {
            ...p.customCricketer,
            stats: {
              ...p.customCricketer.stats,
              runningSpeed: Math.min(99, p.customCricketer.stats.runningSpeed + 5)
            }
          }
        };
      }
    },
    optionB: {
      label: 'Rest Locally',
      outcome: 'Save your hard-earned credits. Recovery is slower: Gain +20 Stamina.',
      effect: (p: CareerProfile): CareerProfile => ({
        ...p,
        stamina: Math.min(100, p.stamina + 20)
      })
    }
  }
];

export const CareerMode: React.FC<CareerModeProps> = ({ onBackToMenu, onPlayCareerMatch }) => {
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  
  // Creation state
  const [name, setName] = useState('');
  const [jerseyName, setJerseyName] = useState('');
  const [kitNumber, setKitNumber] = useState('7');
  const [role, setRole] = useState<CustomCricketer['role']>('AllRounder');
  const [battingStyle, setBattingStyle] = useState<CustomCricketer['battingStyle']>('Right-Hand');
  const [bowlingStyle, setBowlingStyle] = useState<CustomCricketer['bowlingStyle']>('Medium-Pace');
  const [skinTone, setSkinTone] = useState(SKIN_TONES[0].value);
  const [hairStyle, setHairStyle] = useState<CustomCricketer['hairStyle']>('Short');
  const [hairColor, setHairColor] = useState(HAIR_COLORS[0].value);
  const [batBrand, setBatBrand] = useState(BAT_BRANDS[1]); // MRF

  // Allocation Points
  const [availPoints, setAvailPoints] = useState(30);
  const [stats, setStats] = useState({
    battingPower: 35,
    timing: 35,
    bowlingPace: 35,
    bowlingSpin: 35,
    control: 35,
    runningSpeed: 35
  });

  // Load profile from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('cricket_c24_career');
    if (saved) {
      try {
        setProfile(JSON.parse(saved));
      } catch (e) {
        console.warn('Failed parsing saved career', e);
      }
    }
  }, []);

  const handleSaveProfile = (newProfile: CareerProfile) => {
    setProfile(newProfile);
    localStorage.setItem('cricket_c24_career', JSON.stringify(newProfile));
  };

  const adjustStat = (statName: keyof typeof stats, direction: 'up' | 'down') => {
    const currentVal = stats[statName];
    if (direction === 'up' && availPoints > 0 && currentVal < 99) {
      setStats(prev => ({ ...prev, [statName]: currentVal + 2 }));
      setAvailPoints(prev => prev - 1);
      audioEngine.playBatHit(0.4);
    } else if (direction === 'down' && currentVal > 35) {
      setStats(prev => ({ ...prev, [statName]: currentVal - 2 }));
      setAvailPoints(prev => prev + 1);
      audioEngine.playBatHit(0.3);
    }
  };

  const handleCreateCricketer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const customCricketer: CustomCricketer = {
      name: name.trim(),
      role,
      battingStyle,
      bowlingStyle,
      jerseyName: (jerseyName.trim() || name.trim()).toUpperCase(),
      kitNumber,
      skinTone,
      hairStyle,
      hairColor,
      batBrand,
      stats
    };

    const newProfile: CareerProfile = {
      customCricketer,
      currentLevel: 1,
      stamina: 100,
      trainingPoints: 5,
      credits: 200,
      fame: 10,
      matchesPlayed: 0,
      runsScored: 0,
      wicketsTaken: 0,
      highScore: 0,
      notOuts: 0,
      fifties: 0,
      bestBowlingWickets: 0,
      bestBowlingRuns: 0,
      decisionsMade: []
    };

    handleSaveProfile(newProfile);
    audioEngine.playBoundaryCheer();
  };

  const deleteCareer = () => {
    if (window.confirm('Are you sure you want to delete this legendary cricketer? All stats will be permanently erased.')) {
      localStorage.removeItem('cricket_c24_career');
      setProfile(null);
      setName('');
      setJerseyName('');
      setStats({
        battingPower: 35,
        timing: 35,
        bowlingPace: 35,
        bowlingSpin: 35,
        control: 35,
        runningSpeed: 35
      });
      setAvailPoints(30);
    }
  };

  // Perform Career Actions
  const handleTrain = (trainType: 'batting' | 'bowling' | 'gym' | 'rest') => {
    if (!profile) return;

    if (profile.stamina < 15 && trainType !== 'rest') {
      alert('Your cricketer is too fatigued! Settle in for some Rest to recover stamina.');
      return;
    }

    let updated = { ...profile };

    switch (trainType) {
      case 'batting':
        updated.stamina = Math.max(0, updated.stamina - 15);
        updated.customCricketer.stats.timing = Math.min(99, updated.customCricketer.stats.timing + 3);
        updated.customCricketer.stats.battingPower = Math.min(99, updated.customCricketer.stats.battingPower + 2);
        updated.trainingPoints += 1;
        break;
      case 'bowling':
        updated.stamina = Math.max(0, updated.stamina - 15);
        updated.customCricketer.stats.control = Math.min(99, updated.customCricketer.stats.control + 3);
        if (profile.customCricketer.bowlingStyle.includes('Spin')) {
          updated.customCricketer.stats.bowlingSpin = Math.min(99, updated.customCricketer.stats.bowlingSpin + 2);
        } else {
          updated.customCricketer.stats.bowlingPace = Math.min(99, updated.customCricketer.stats.bowlingPace + 2);
        }
        updated.trainingPoints += 1;
        break;
      case 'gym':
        if (profile.credits < 50) {
          alert('Not enough credits for the premium gym trainer (requires 50 Credits).');
          return;
        }
        updated.credits -= 50;
        updated.stamina = Math.max(0, updated.stamina - 20);
        updated.customCricketer.stats.runningSpeed = Math.min(99, updated.customCricketer.stats.runningSpeed + 4);
        updated.trainingPoints += 2;
        break;
      case 'rest':
        updated.stamina = Math.min(100, updated.stamina + 40);
        break;
    }

    handleSaveProfile(updated);
    audioEngine.playSwoosh();
  };

  const makeDecision = (decisionId: string, option: 'A' | 'B') => {
    if (!profile) return;
    const decision = CAREER_DECISIONS.find(d => d.id === decisionId);
    if (!decision) return;

    let updated = option === 'A' ? decision.optionA.effect(profile) : decision.optionB.effect(profile);
    updated.decisionsMade = [...updated.decisionsMade, decisionId];

    handleSaveProfile(updated);
    audioEngine.playBoundaryCheer();
  };

  const launchCareerMatch = (matchOpp: string) => {
    if (!profile) return;
    if (profile.stamina < 20) {
      alert('Your cricketer has extremely low stamina! Train on "Rest" first to ensure you are fit to play!');
      return;
    }

    // Set custom player values
    const customPlayer: Player = {
      id: 'career_custom',
      name: profile.customCricketer.name,
      role: profile.customCricketer.role,
      battingStyle: profile.customCricketer.battingStyle,
      bowlingStyle: profile.customCricketer.bowlingStyle,
      rating: Math.round(
        (profile.customCricketer.stats.battingPower + 
         profile.customCricketer.stats.timing + 
         profile.customCricketer.stats.runningSpeed) / 3
      ),
      battingRating: Math.round((profile.customCricketer.stats.battingPower + profile.customCricketer.stats.timing) / 2),
      bowlingRating: Math.round((profile.customCricketer.stats.control + (profile.customCricketer.bowlingStyle.includes('Spin') ? profile.customCricketer.stats.bowlingSpin : profile.customCricketer.stats.bowlingPace)) / 2)
    };

    // Pick teams based on Level
    const currentLvl = CAREER_LEVELS.find(l => l.level === profile.currentLevel)!;
    
    // User Team: India as fallback, or custom roster insertion in match setup
    const userTeam = { ...TEAMS[0] }; // Default team is India representing the player's national side
    userTeam.name = `${profile.customCricketer.name}'s XI`;
    userTeam.flagEmoji = '🎓';
    userTeam.players = [customPlayer, ...TEAMS[0].players.slice(1)]; // Inject custom player at top!

    // Create an opponent team
    const opponentTeam = { ...TEAMS[1] };
    opponentTeam.name = matchOpp;
    opponentTeam.flagEmoji = '🏟';

    // Lower player stamina on match play
    const nextStaminaProfile = {
      ...profile,
      stamina: Math.max(10, profile.stamina - 25)
    };
    handleSaveProfile(nextStaminaProfile);

    onPlayCareerMatch(userTeam, opponentTeam, 2, 'medium', (runs, wickets) => {
      const updatedProfile = {
        ...nextStaminaProfile,
        runsScored: nextStaminaProfile.runsScored + runs,
        wicketsTaken: nextStaminaProfile.wicketsTaken + wickets,
        matchesPlayed: nextStaminaProfile.matchesPlayed + 1,
        credits: nextStaminaProfile.credits + currentLvl.reward,
        fame: nextStaminaProfile.fame + 15,
        highScore: Math.max(nextStaminaProfile.highScore, runs)
      };
      localStorage.setItem('cricket_c24_career', JSON.stringify(updatedProfile));
      setProfile(updatedProfile);
    });
  };

  // Check if player can level up
  const handleLevelUp = () => {
    if (!profile || profile.currentLevel >= 4) return;
    
    const nextLvl = profile.currentLevel + 1;
    const updated = {
      ...profile,
      currentLevel: nextLvl as any,
      credits: profile.credits + 500,
      fame: profile.fame + 50,
      trainingPoints: profile.trainingPoints + 10
    };
    handleSaveProfile(updated);
    audioEngine.playBoundaryCheer();
  };

  return (
    <div className="w-full flex flex-col gap-6 font-sans text-white p-2" id="career-mode-lobby">
      
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-emerald to-brand-sky flex items-center justify-center text-black font-black">
            <User size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">CRICKETER <span className="text-brand-emerald text-glow-emerald">CAREER MODE</span></h1>
            <p className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">Ascend from state academies to world championship immortality</p>
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
        {!profile ? (
          /* Character Creator Screen */
          <motion.form 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            onSubmit={handleCreateCricketer}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left: Bio Info */}
            <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-2xl flex flex-col gap-4">
              <span className="text-[10px] font-black text-brand-emerald tracking-widest uppercase block border-b border-white/10 pb-2">
                1. PLAYER BIOGRAPHY
              </span>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-black tracking-wide text-neutral-400">Cricketer Full Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => {
                    setName(e.target.value);
                    if(!jerseyName) setJerseyName(e.target.value.split(' ').pop() || '');
                  }}
                  required
                  placeholder="e.g. Jasprit Kohli" 
                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:border-brand-emerald"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-black tracking-wide text-neutral-400">Jersey Name</label>
                  <input 
                    type="text" 
                    value={jerseyName} 
                    onChange={(e) => setJerseyName(e.target.value)}
                    placeholder="KOHLI" 
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm font-black text-white focus:outline-none focus:border-brand-emerald uppercase"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-black tracking-wide text-neutral-400">Kit Number (1-99)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="99" 
                    value={kitNumber} 
                    onChange={(e) => setKitNumber(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm font-black text-white focus:outline-none focus:border-brand-emerald"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-black tracking-wide text-neutral-400">Primary Speciality Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Batsman', 'Bowler', 'AllRounder', 'WicketKeeper'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-2.5 rounded-lg border text-xs font-black uppercase transition-all ${
                        role === r 
                          ? 'bg-brand-emerald border-brand-emerald text-black shadow-[0_0_12px_rgba(0,255,133,0.25)]' 
                          : 'bg-black/40 border-white/5 hover:border-white/15'
                      }`}
                    >
                      {r === 'WicketKeeper' ? 'Keeper-Bat' : r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-black tracking-wide text-neutral-400">Batting Hand</label>
                  <select 
                    value={battingStyle} 
                    onChange={(e: any) => setBattingStyle(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-black text-white uppercase focus:outline-none focus:border-brand-emerald"
                  >
                    <option value="Right-Hand">Right-Hand</option>
                    <option value="Left-Hand">Left-Hand</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] uppercase font-black tracking-wide text-neutral-400">Bowling Style</label>
                  <select 
                    value={bowlingStyle} 
                    onChange={(e: any) => setBowlingStyle(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-black text-white uppercase focus:outline-none focus:border-brand-emerald"
                  >
                    <option value="Fast-Pace">Fast Pace</option>
                    <option value="Medium-Pace">Medium Pace</option>
                    <option value="Off-Spin">Off Spin</option>
                    <option value="Leg-Spin">Leg Spin</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Middle: Cosmetic Options */}
            <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-2xl flex flex-col gap-4">
              <span className="text-[10px] font-black text-brand-sky tracking-widest uppercase block border-b border-white/10 pb-2">
                2. KIT & APPEARANCE
              </span>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-black tracking-wide text-neutral-400">Skin Complexion</label>
                <div className="flex gap-2">
                  {SKIN_TONES.map((tone) => (
                    <button
                      key={tone.value}
                      type="button"
                      onClick={() => setSkinTone(tone.value)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        skinTone === tone.value ? 'scale-110 border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: tone.value }}
                      title={tone.label}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase font-black tracking-wide text-neutral-400">Hair Style</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {HAIR_STYLES.map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setHairStyle(style)}
                      className={`py-2 rounded-lg border text-[10px] font-black uppercase transition-all ${
                        hairStyle === style 
                          ? 'bg-brand-sky border-brand-sky text-black' 
                          : 'bg-black/40 border-white/5 hover:border-white/15'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-black tracking-wide text-neutral-400">Hair Color</label>
                <div className="flex gap-3">
                  {HAIR_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setHairColor(color.value)}
                      className={`px-3 py-1.5 rounded border text-[10px] font-bold uppercase transition ${
                        hairColor === color.value 
                          ? 'border-brand-sky text-brand-sky bg-brand-sky/10' 
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full inline-block mr-1" style={{ backgroundColor: color.value }} /> {color.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1 mt-1">
                <label className="text-[10px] uppercase font-black tracking-wide text-neutral-400">Custom Bat Brand</label>
                <div className="grid grid-cols-2 gap-2">
                  {BAT_BRANDS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBatBrand(b)}
                      className={`py-2.5 rounded-lg border text-xs font-black uppercase transition-all ${
                        batBrand === b 
                          ? 'bg-white/10 border-white/30 text-white shadow-[0_0_10px_rgba(255,255,255,0.05)]' 
                          : 'bg-black/40 border-white/5 hover:border-white/15'
                      }`}
                    >
                      🏏 {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Stat Allocator & Submit */}
            <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                  <span className="text-[10px] font-black text-brand-emerald tracking-widest uppercase">
                    3. STATISTIC ALLOCATOR
                  </span>
                  <span className="text-[10px] font-black bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20 px-2.5 py-1 rounded">
                    POINTS LEFT: {availPoints}
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {(Object.keys(stats) as Array<keyof typeof stats>).map((key) => (
                    <div key={key} className="flex items-center justify-between bg-black/40 border border-white/5 p-2.5 rounded-xl">
                      <div>
                        <span className="text-xs font-black uppercase block text-neutral-200">
                          {(key as string).replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <span className="text-[9px] font-semibold text-neutral-500 uppercase">
                          {key === 'battingPower' || key === 'timing' ? 'BATTING SKILL' : key === 'runningSpeed' ? 'FITNESS SKILL' : 'BOWLING SKILL'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => adjustStat(key, 'down')}
                          className="p-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="font-mono text-sm font-black w-7 text-center text-brand-sky">{stats[key]}</span>
                        <button
                          type="button"
                          onClick={() => adjustStat(key, 'up')}
                          className="p-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!name.trim() || availPoints > 0}
                className={`w-full py-3.5 rounded-xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition transform active:scale-95 mt-5 ${
                  name.trim() && availPoints === 0
                    ? 'bg-gradient-to-r from-brand-emerald to-brand-sky hover:opacity-95 text-black shadow-[0_0_15px_rgba(0,255,133,0.3)]'
                    : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-white/5'
                }`}
              >
                <Sparkles size={14} /> Create Professional Player
              </button>
            </div>
          </motion.form>
        ) : (
          /* Career Dashboard Screen */
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left Column: Player Bio & Stats Card */}
            <div className="flex flex-col gap-6">
              
              {/* Immersive Player Card */}
              <div className="bg-[#0A0F0D]/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
                <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-brand-emerald to-brand-sky" />
                
                {/* Visual Avatar Panel */}
                <div className="p-6 bg-gradient-to-b from-brand-emerald/10 to-transparent flex flex-col items-center text-center border-b border-white/5">
                  <div 
                    className="w-16 h-16 rounded-full border-2 border-brand-emerald flex items-center justify-center text-4xl mb-3 shadow-[0_0_15px_rgba(0,255,133,0.2)]"
                    style={{ backgroundColor: profile.customCricketer.skinTone }}
                  >
                    {profile.customCricketer.hairStyle === 'Bald' ? '👨‍🦲' : '👨'}
                  </div>
                  <h2 className="text-xl font-black italic uppercase text-neutral-100">{profile.customCricketer.name}</h2>
                  <span className="text-[10px] font-black text-brand-emerald tracking-widest uppercase bg-brand-emerald/10 px-2 py-0.5 rounded border border-brand-emerald/20 mt-1.5">
                    Level {profile.currentLevel}: {CAREER_LEVELS.find(l => l.level === profile.currentLevel)?.name}
                  </span>
                  
                  {/* Cosmetic Bio details */}
                  <div className="flex flex-wrap gap-2 mt-4 justify-center text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                    <span className="bg-white/5 px-2 py-1 rounded">No. {profile.customCricketer.kitNumber}</span>
                    <span className="bg-white/5 px-2 py-1 rounded">{profile.customCricketer.role}</span>
                    <span className="bg-white/5 px-2 py-1 rounded">{profile.customCricketer.battingStyle} Bat</span>
                    <span className="bg-white/5 px-2 py-1 rounded">Bat: {profile.customCricketer.batBrand}</span>
                  </div>
                </div>

                {/* Stat bars */}
                <div className="p-5 flex flex-col gap-3 bg-black/30">
                  <span className="text-[10px] font-black text-neutral-400 tracking-widest uppercase block border-b border-white/5 pb-1 mb-1">
                    PERFORMANCE RATINGS
                  </span>
                  {(Object.keys(profile.customCricketer.stats) as Array<keyof typeof profile.customCricketer.stats>).map((key) => {
                    const val = profile.customCricketer.stats[key];
                    return (
                      <div key={key} className="flex flex-col gap-1">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-wide">
                          <span className="text-neutral-400">{(key as string).replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="text-brand-sky font-mono">{val}</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-sky rounded-full" style={{ width: `${val}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Resource stats ledger */}
              <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-xl flex flex-col gap-3">
                <span className="text-[10px] font-black text-white tracking-widest uppercase border-b border-white/10 pb-2 block">
                  FINANCIALS & STAMINA
                </span>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                    <span className="text-[9px] font-bold uppercase text-neutral-500 block">Stamina</span>
                    <span className="text-lg font-mono font-black text-glow-emerald text-brand-emerald">{profile.stamina}%</span>
                  </div>
                  <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                    <span className="text-[9px] font-bold uppercase text-neutral-500 block">Fame</span>
                    <span className="text-lg font-mono font-black text-brand-sky">{profile.fame} ⭐</span>
                  </div>
                  <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                    <span className="text-[9px] font-bold uppercase text-neutral-500 block">Credits</span>
                    <span className="text-lg font-mono font-black text-white">{profile.credits} cr</span>
                  </div>
                  <div className="bg-black/40 border border-white/5 p-3 rounded-xl">
                    <span className="text-[9px] font-bold uppercase text-neutral-500 block">Train Points</span>
                    <span className="text-lg font-mono font-black text-neutral-300">{profile.trainingPoints} pts</span>
                  </div>
                </div>

                <button 
                  onClick={deleteCareer}
                  className="w-full py-2 border border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition mt-2"
                >
                  Delete Career Profile
                </button>
              </div>
            </div>

            {/* Middle Column: Career Training & Decisions */}
            <div className="lg:col-span-2 flex flex-col gap-6">

              {/* Stats Career Milestones */}
              <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-xl grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <span className="text-lg font-mono font-black text-brand-emerald block">{profile.runsScored}</span>
                  <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Total Runs</span>
                </div>
                <div className="text-center border-l border-white/5">
                  <span className="text-lg font-mono font-black text-brand-sky block">{profile.wicketsTaken}</span>
                  <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Total Wickets</span>
                </div>
                <div className="text-center border-l border-white/5">
                  <span className="text-lg font-mono font-black text-neutral-300 block">{profile.matchesPlayed}</span>
                  <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">Matches</span>
                </div>
                <div className="text-center border-l border-white/5">
                  <span className="text-lg font-mono font-black text-brand-sky block">{profile.highScore}*</span>
                  <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-widest">High Score</span>
                </div>
              </div>

              {/* Training Nets */}
              <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-xl flex flex-col gap-4">
                <span className="text-[10px] font-black text-brand-emerald tracking-widest uppercase block border-b border-white/10 pb-2">
                  ACTS: NET PRACTICE & RECOVERY
                </span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-black/40 border border-white/5 p-3.5 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black uppercase text-neutral-200">Batting Net Session</h4>
                      <p className="text-[10px] text-neutral-500 mt-0.5">Focus timing & power nets</p>
                      <span className="text-[9px] text-brand-emerald font-black uppercase mt-1 inline-block">+3 Timing, +2 Power, -15 Stamina</span>
                    </div>
                    <button
                      onClick={() => handleTrain('batting')}
                      className="p-2.5 bg-brand-emerald hover:bg-brand-emerald/90 text-black font-black rounded-lg text-xs"
                      title="Train batting"
                    >
                      <Zap size={13} />
                    </button>
                  </div>

                  <div className="bg-black/40 border border-white/5 p-3.5 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black uppercase text-neutral-200">Bowling Net Session</h4>
                      <p className="text-[10px] text-neutral-500 mt-0.5">Work on control & spin/pace</p>
                      <span className="text-[9px] text-brand-sky font-black uppercase mt-1 inline-block">+3 Control, +2 Pace/Spin, -15 Stamina</span>
                    </div>
                    <button
                      onClick={() => handleTrain('bowling')}
                      className="p-2.5 bg-brand-sky hover:bg-brand-sky/90 text-black font-black rounded-lg text-xs"
                      title="Train bowling"
                    >
                      <Zap size={13} />
                    </button>
                  </div>

                  <div className="bg-black/40 border border-white/5 p-3.5 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black uppercase text-neutral-200">Gym Athletic Session</h4>
                      <p className="text-[10px] text-neutral-500 mt-0.5">High altitude sprints and weights</p>
                      <span className="text-[9px] text-brand-sky font-black uppercase mt-1 inline-block">+4 Running Speed, -20 Stamina (Cost: 50cr)</span>
                    </div>
                    <button
                      onClick={() => handleTrain('gym')}
                      className="p-2.5 bg-white/10 hover:bg-white/15 text-white border border-white/15 font-black rounded-lg text-xs"
                      title="Gym trainer"
                    >
                      <Dumbbell size={13} />
                    </button>
                  </div>

                  <div className="bg-black/40 border border-white/5 p-3.5 rounded-xl flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-black uppercase text-neutral-200">Settle in for Rest</h4>
                      <p className="text-[10px] text-neutral-500 mt-0.5">Recover physical stamina safely</p>
                      <span className="text-[9px] text-brand-emerald font-black uppercase mt-1 inline-block">+40 Stamina</span>
                    </div>
                    <button
                      onClick={() => handleTrain('rest')}
                      className="p-2.5 bg-white/10 hover:bg-white/15 text-white border border-white/15 font-black rounded-lg text-xs"
                      title="Rest up"
                    >
                      <CheckCircle2 size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Career Decisions Module */}
              {CAREER_DECISIONS.filter(d => !profile.decisionsMade.includes(d.id)).slice(0, 1).map((decision) => (
                <div key={decision.id} className="bg-[#0A0F0D]/90 border border-brand-emerald/30 p-5 rounded-2xl shadow-xl flex flex-col gap-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-emerald to-transparent" />
                  <span className="text-[10px] font-black text-brand-emerald tracking-widest uppercase flex items-center gap-1">
                    <BookOpen size={12} /> INTERACTIVE CAREER-DEFINING DECISION
                  </span>
                  <h3 className="text-sm font-black uppercase text-neutral-200">{decision.title}</h3>
                  <p className="text-xs text-neutral-400 leading-relaxed font-medium">{decision.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    <button
                      onClick={() => makeDecision(decision.id, 'A')}
                      className="p-3.5 bg-black/60 hover:bg-white/5 border border-white/10 rounded-xl text-left text-xs font-bold leading-relaxed transition"
                    >
                      <span className="font-black block uppercase text-brand-emerald mb-1">Option A: {decision.optionA.label}</span>
                      <span className="text-neutral-400 text-[10px] block font-semibold">{decision.optionA.outcome}</span>
                    </button>
                    <button
                      onClick={() => makeDecision(decision.id, 'B')}
                      className="p-3.5 bg-black/60 hover:bg-white/5 border border-white/10 rounded-xl text-left text-xs font-bold leading-relaxed transition"
                    >
                      <span className="font-black block uppercase text-brand-sky mb-1">Option B: {decision.optionB.label}</span>
                      <span className="text-neutral-400 text-[10px] block font-semibold">{decision.optionB.outcome}</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* Match Selection Play Panel */}
              <div className="bg-[#0A0F0D]/90 border border-white/10 p-5 rounded-2xl shadow-xl flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-[10px] font-black text-white tracking-widest uppercase">
                    AVAILABLE TOURNAMENT FIXTURES
                  </span>
                  {/* Level Up Button if qualifications met */}
                  {profile.currentLevel < 4 && profile.runsScored >= (profile.currentLevel * 100) && (
                    <button
                      onClick={handleLevelUp}
                      className="text-[10px] font-black bg-brand-emerald text-black px-2.5 py-1 rounded animate-bounce shadow-[0_0_10px_rgba(0,255,133,0.3)]"
                    >
                      ⭐⭐ LEVEL UP TO LEVEL {profile.currentLevel + 1}! ⭐⭐
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {CAREER_LEVELS.find(l => l.level === profile.currentLevel)?.matches.map((matchOpp, idx) => (
                    <div key={idx} className="bg-black/40 border border-white/5 hover:border-white/15 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 transition duration-150">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">🏆</span>
                        <div>
                          <h4 className="text-xs font-black uppercase text-neutral-200">
                            {CAREER_LEVELS.find(l => l.level === profile.currentLevel)?.matchTitle} • Fixture {idx + 1}
                          </h4>
                          <p className="text-[10px] text-neutral-500 font-bold uppercase mt-0.5">
                            Opponent Team: <span className="text-neutral-300 font-black">{matchOpp}</span> • Match Length: 2 Overs
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-mono font-black text-brand-emerald bg-brand-emerald/10 border border-brand-emerald/20 px-2.5 py-1 rounded uppercase">
                          +{CAREER_LEVELS.find(l => l.level === profile.currentLevel)?.reward} cr
                        </span>
                        <button
                          onClick={() => launchCareerMatch(matchOpp)}
                          className="px-4 py-2 bg-gradient-to-r from-brand-emerald to-brand-sky hover:opacity-95 text-black font-black text-xs uppercase tracking-widest rounded-xl flex items-center gap-1.5 transition transform active:scale-95 shadow-[0_0_12px_rgba(0,255,133,0.2)]"
                        >
                          Play Match <Play size={11} fill="black" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
