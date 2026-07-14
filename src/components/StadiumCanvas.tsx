import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Player, Team, BallPhysics, BallHistory, Innings } from '../types';
import { Play, ShieldAlert, Zap, Target, RefreshCw } from 'lucide-react';
import { audioEngine } from '../lib/audio';

interface StadiumCanvasProps {
  battingTeam: Team;
  bowlingTeam: Team;
  activeBatsman: Player;
  currentBowler: Player;
  isUserBatting: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  innings: Innings;
  onBallCompleted: (runs: number, isWicket: boolean, outReason?: string, speed?: number, type?: string, pitchX?: number, pitchY?: number, shotAngle?: number, distance?: number) => void;
  // MULTIPLAYER SYNC PROPS
  isMultiplayer?: boolean;
  mpRole?: 'host' | 'guest' | null;
  mpOpponentAction?: { type: string; payload: any } | null;
  mpEmitAction?: (type: string, payload: any) => void;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export const StadiumCanvas: React.FC<StadiumCanvasProps> = ({
  battingTeam,
  bowlingTeam,
  activeBatsman,
  currentBowler,
  isUserBatting,
  difficulty,
  innings,
  onBallCompleted,
  isMultiplayer = false,
  mpRole = null,
  mpOpponentAction = null,
  mpEmitAction
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasTriggeredResultRef = useRef(false);

  // View state: 'batting' | 'bowling' | 'fielding' | 'stumps-replay'
  const [viewMode, setViewMode] = useState<'batting' | 'bowling' | 'fielding'>('batting');
  
  // Game state controls
  const [isBallActive, setIsBallActive] = useState(false);
  const [bowlStage, setBowlStage] = useState<'aiming' | 'power-meter' | 'released' | 'completed'>('aiming');
  const [batStage, setBatStage] = useState<'ready' | 'swung' | 'running' | 'completed'>('ready');
  const [isThrownBack, setIsThrownBack] = useState(false);
  
  // Scoring / Running state
  const [runsScoredThisBall, setRunsScoredThisBall] = useState(0);
  const [currentRunningDistance, setCurrentRunningDistance] = useState(0); // 0 to 1 (representing fraction of run completed)
  const [isRunning, setIsRunning] = useState(false);
  const [batsmanDirection, setBatsmanDirection] = useState<1 | -1>(1); // 1 = running forward, -1 = running backward
  const [totalRunsAttempted, setTotalRunsAttempted] = useState(0);
  
  // Bowling Aim Markers (metres from Bowler crease)
  const [aimMarker, setAimMarker] = useState({ x: 0, y: 15 }); // 0 is middle, 15m down pitch
  const [bowlerPower, setBowlerPower] = useState(0);
  const [bowlerPowerDir, setBowlerPowerDir] = useState(1);
  const [bowlingTypeSelected, setBowlingTypeSelected] = useState<'Fast' | 'Spin'>('Fast');
  
  // Batting state
  const [batShotDirection, setBatShotDirection] = useState(0); // in degrees: 0 is straight, -90 is off-side, 90 is on-side
  const [batLoft, setBatLoft] = useState(false); // ground vs lofted toggle
  const [batSwingTime, setBatSwingTime] = useState<number | null>(null);
  const [batTimingLabel, setBatTimingLabel] = useState<string>('');
  const [batTimingColor, setBatTimingColor] = useState<string>('text-neutral-400');
  
  // Physics states
  const [ball, setBall] = useState<BallPhysics>({
    x: 0, y: 0, z: 2.2,
    vx: 0, vy: 0, vz: 0,
    ax: 0, ay: 0, az: -9.8,
    spin: 0, swing: 0,
    bounced: false, hit: false, isStumpHit: false, isOut: false
  });

  // Stumps state
  const [stumpStatus, setStumpStatus] = useState({
    bailsFlipped: false,
    leftStumpAngle: 0,
    midStumpAngle: 0,
    rightStumpAngle: 0,
    stumpShatterParticles: false
  });

  // Fielder AI configurations (Positions relative to batsman Y=20.12m)
  const [fielders, setFielders] = useState<{
    name: string;
    x: number;
    y: number; // Y coordinate in stadium (-50m to 50m)
    vx: number;
    vy: number;
    state: 'idle' | 'chasing' | 'throwing' | 'done';
  }[]>([
    { name: 'Slip', x: -3, y: 22, vx: 0, vy: 0, state: 'idle' },
    { name: 'Point', x: -25, y: 20, vx: 0, vy: 0, state: 'idle' },
    { name: 'Cover', x: -18, y: 12, vx: 0, vy: 0, state: 'idle' },
    { name: 'Mid-off', x: -8, y: 5, vx: 0, vy: 0, state: 'idle' },
    { name: 'Mid-on', x: 8, y: 5, vx: 0, vy: 0, state: 'idle' },
    { name: 'Mid-wicket', x: 18, y: 12, vx: 0, vy: 0, state: 'idle' },
    { name: 'Square Leg', x: 25, y: 20, vx: 0, vy: 0, state: 'idle' },
    { name: 'Fine Leg', x: 12, y: 32, vx: 0, vy: 0, state: 'idle' },
    { name: 'Third Man', x: -15, y: 35, vx: 0, vy: 0, state: 'idle' },
  ]);

  const [particles, setParticles] = useState<Particle[]>([]);
  const [stadiumTimeOfDay, setStadiumTimeOfDay] = useState<'Day' | 'Twilight' | 'Night'>('Night');
  const [isWicketAnimationActive, setIsWicketAnimationActive] = useState(false);
  const [wicketAnimationTimer, setWicketAnimationTimer] = useState(0);

  // Camera Settings
  const cameraRef = useRef({ x: 0, y: 23, z: 1.6 });

  // Initialize view mode based on who is batting
  useEffect(() => {
    setViewMode(isUserBatting ? 'batting' : 'bowling');
    resetBallState();

    if (isUserBatting && !isMultiplayer) {
      const timer = setTimeout(() => {
        triggerAIBowler();
      }, 1200);
      return () => clearTimeout(timer);
    } else if (!isUserBatting && !isMultiplayer) {
      // User is bowling: automatically start bowling delivery run-up / power-meter after 2s to ensure a continuous experience!
      const timer = setTimeout(() => {
        startBowlingPowerMeter();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isUserBatting, innings.balls, isMultiplayer]);

  // Handle keys for shot direction & aiming
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((bowlStage === 'aiming' || bowlStage === 'power-meter') && !isUserBatting) {
        // AI or Bowler User aiming (allowed during aiming or run-up stages)
        if (e.key === 'ArrowLeft' || e.key === 'a') {
          setAimMarker(prev => ({ ...prev, x: Math.max(-0.8, prev.x - 0.1) }));
        }
        if (e.key === 'ArrowRight' || e.key === 'd') {
          setAimMarker(prev => ({ ...prev, x: Math.min(0.8, prev.x + 0.1) }));
        }
        if (e.key === 'ArrowUp' || e.key === 'w') {
          setAimMarker(prev => ({ ...prev, y: Math.max(12, prev.y - 0.25) }));
        }
        if (e.key === 'ArrowDown' || e.key === 's') {
          setAimMarker(prev => ({ ...prev, y: Math.min(18, prev.y + 0.25) }));
        }
        if (e.key === 'Spacebar' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          if (bowlStage === 'aiming') {
            startBowlingPowerMeter();
          } else {
            releaseBall();
          }
        }
      } else if (batStage === 'ready' && isUserBatting) {
        // User Batting controls
        if (e.key === 'ArrowLeft' || e.key === 'a') {
          setBatShotDirection(prev => Math.max(-120, prev - 10));
        }
        if (e.key === 'ArrowRight' || e.key === 'd') {
          setBatShotDirection(prev => Math.min(120, prev + 10));
        }
        if (e.key === 'ArrowUp' || e.key === 'w') {
          setBatLoft(true);
        }
        if (e.key === 'ArrowDown' || e.key === 's') {
          setBatLoft(false);
        }
        if (e.key === 'Spacebar' || e.key === ' ') {
          e.preventDefault();
          swingBat();
        }
      } else if (batStage === 'running') {
        if (e.key === 'Spacebar' || e.key === ' ' || e.key === 'r') {
          e.preventDefault();
          toggleRunning();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bowlStage, batStage, isUserBatting, bowlingTypeSelected, aimMarker, batShotDirection, batLoft]);

  const resetBallState = () => {
    hasTriggeredResultRef.current = false;
    setIsThrownBack(false);
    setBall({
      x: 0, y: 0, z: 2.2,
      vx: 0, vy: 0, vz: 0,
      ax: 0, ay: 0, az: -9.8,
      spin: 0, swing: 0,
      bounced: false, hit: false, isStumpHit: false, isOut: false
    });
    setStumpStatus({
      bailsFlipped: false,
      leftStumpAngle: 0,
      midStumpAngle: 0,
      rightStumpAngle: 0,
      stumpShatterParticles: false
    });
    setIsBallActive(false);
    setBowlStage('aiming');
    setBatStage('ready');
    setIsRunning(false);
    setCurrentRunningDistance(0);
    setBatsmanDirection(1);
    setTotalRunsAttempted(0);
    setRunsScoredThisBall(0);
    setBatSwingTime(null);
    setBatTimingLabel('');
    setParticles([]);
    setIsWicketAnimationActive(false);

    // Reset fielder positions
    setFielders([
      { name: 'Slip', x: -4, y: 22, vx: 0, vy: 0, state: 'idle' },
      { name: 'Point', x: -25, y: 20, vx: 0, vy: 0, state: 'idle' },
      { name: 'Cover', x: -20, y: 12, vx: 0, vy: 0, state: 'idle' },
      { name: 'Mid-off', x: -8, y: 4, vx: 0, vy: 0, state: 'idle' },
      { name: 'Mid-on', x: 8, y: 4, vx: 0, vy: 0, state: 'idle' },
      { name: 'Mid-wicket', x: 20, y: 12, vx: 0, vy: 0, state: 'idle' },
      { name: 'Square Leg', x: 25, y: 20, vx: 0, vy: 0, state: 'idle' },
      { name: 'Fine Leg', x: 12, y: 32, vx: 0, vy: 0, state: 'idle' },
      { name: 'Third Man', x: -15, y: 35, vx: 0, vy: 0, state: 'idle' },
    ]);
  };

  // MULTIPLAYER REALTIME ACTION SYNCRONIZER
  useEffect(() => {
    if (!isMultiplayer || !mpOpponentAction) return;
    const { type, payload } = mpOpponentAction;

    switch (type) {
      case 'opponent_delivered': {
        hasTriggeredResultRef.current = false;
        setAimMarker({ x: payload.pitchX, y: payload.pitchY });
        setBowlerPower(payload.releasePower);
        setBowlingTypeSelected(payload.deliveryType);
        // Fire standard release simulation
        setIsBallActive(true);
        setBowlStage('released');
        audioEngine.playSwoosh();
        
        // Emulate bowler delivery
        let speedKph = payload.deliveryType === 'Fast' ? 135 : 85;
        const vy = speedKph / 3.6;
        const t = payload.pitchY / vy;
        const vz = (4.9 * t * t - 2.2) / t;
        const vx = (payload.pitchX - 0.5 * 0 * t * t) / t;

        setBall({
          x: 0, y: 0, z: 2.2,
          vx, vy, vz,
          ax: 0, ay: -0.04, az: -9.8,
          spin: 0, swing: 0,
          bounced: false, hit: false, isStumpHit: false, isOut: false
        });
        break;
      }
      case 'opponent_swung': {
        setBatStage('swung');
        setBatSwingTime(Date.now());
        break;
      }
      case 'ball_result_synced': {
        completeBallCycle(payload.runs, payload.isWicket, payload.outReason);
        break;
      }
    }
  }, [mpOpponentAction, isMultiplayer]);

  // AI Bowler Engine
  const triggerAIBowler = () => {
    if (isBallActive || bowlStage !== 'aiming') return;
    
    // Select randomized aim point based on difficulty
    const aimX = (Math.random() * 1.4 - 0.7); // aim line
    const aimY = 13.5 + Math.random() * 3.5; // aim length (Good length is 14.5-16m)
    setAimMarker({ x: aimX, y: aimY });
    
    // Choose delivery type randomly
    const types: ('Fast' | 'Spin')[] = ['Fast', 'Spin'];
    const chosenType = types[Math.floor(Math.random() * types.length)];
    setBowlingTypeSelected(chosenType);

    // Simulating run up
    setBowlStage('power-meter');
    setBowlerPower(80 + Math.random() * 15); // Release perfect sweet spot

    setTimeout(() => {
      releaseBallAI(aimX, aimY, chosenType);
    }, 1500);
  };

  const startBowlingPowerMeter = () => {
    setBowlStage('power-meter');
    setBowlerPower(0);
    setBowlerPowerDir(1);
    audioEngine.startAmbient();
  };

  // Run a high-frequency loop for bowler power meter
  useEffect(() => {
    if (bowlStage !== 'power-meter') return;
    const interval = setInterval(() => {
      setBowlerPower(prev => {
        let next = prev + bowlerPowerDir * 4;
        if (next >= 100) {
          next = 100;
          setBowlerPowerDir(-1);
        } else if (next <= 0) {
          next = 0;
          setBowlerPowerDir(1);
        }
        return next;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [bowlStage, bowlerPowerDir]);

  // Release ball by User Bowling
  const releaseBall = () => {
    if (bowlStage !== 'power-meter') return;
    hasTriggeredResultRef.current = false;
    setBowlStage('released');
    setIsBallActive(true);
    audioEngine.playSwoosh();

    if (isMultiplayer && mpEmitAction) {
      mpEmitAction('bowler_pitch', {
        deliveryType: bowlingTypeSelected,
        pitchX: aimMarker.x,
        pitchY: aimMarker.y,
        releasePower: bowlerPower
      });
    }

    // Determine speed and spin deviation based on power meter rating
    const power = bowlerPower;
    const isPerfectRelease = power >= 75 && power <= 90;
    
    let speedKph = 0;
    let vy = 0;
    let vz = 0;
    let swingRate = 0;
    let spinRate = 0;

    if (bowlingTypeSelected === 'Fast') {
      speedKph = isPerfectRelease ? 142 : 115 + (power / 100) * 20; // Fast speed
      vy = (speedKph / 3.6); // m/s
      vz = -1.2; // slight down vector
      swingRate = (Math.random() * 0.4 - 0.2); // Swing in air
    } else {
      speedKph = isPerfectRelease ? 88 : 70 + (power / 100) * 15; // Spin speed
      vy = (speedKph / 3.6);
      vz = 1.0; // Higher flight loop
      spinRate = (Math.random() * 1.2 - 0.6); // Break on bounce
    }

    // Aim calculations
    const timeToPitch = aimMarker.y / vy;
    const gravity = -9.8;
    
    // Calculate required Vz to bounce at Y=aimMarker.y
    // Z_pitch = Z_start + Vz * t + 0.5 * g * t^2. We want Z_pitch = 0.
    // 0 = 2.2 + Vz * t - 4.9 * t^2 => Vz = (4.9 * t^2 - 2.2) / t
    const t = timeToPitch;
    vz = (4.9 * t * t - 2.2) / t;

    // Calculate required Vx to hit target aimMarker.x at pitch
    // X_pitch = Vx * t + 0.5 * Ax * t^2 => Vx = (X_pitch - 0.5 * Ax * t^2) / t
    const ax = swingRate;
    const vx = (aimMarker.x - 0.5 * ax * t * t) / t;

    setBall({
      x: 0, y: 0, z: 2.2,
      vx, vy, vz,
      ax, ay: -0.05, az: gravity,
      spin: spinRate, swing: swingRate,
      bounced: false, hit: false, isStumpHit: false, isOut: false
    });

    // Switch view immediately to Batting Camera (which is the TV Action view)
    setViewMode('batting');

    // Trigger AI batsman swings if user is bowling!
    triggerAIBatsmanSwing(aimMarker.x, aimMarker.y, speedKph, vy);
  };

  // Release ball automatically for AI Bowler
  const releaseBallAI = (targetX: number, targetY: number, deliveryType: 'Fast' | 'Spin') => {
    hasTriggeredResultRef.current = false;
    setIsBallActive(true);
    setBowlStage('released');
    audioEngine.playSwoosh();

    let speedKph = deliveryType === 'Fast' ? 130 + Math.random() * 15 : 82 + Math.random() * 10;
    const vy = speedKph / 3.6;
    const gravity = -9.8;
    const swingRate = deliveryType === 'Fast' ? (Math.random() * 0.5 - 0.25) : 0;
    const spinRate = deliveryType === 'Spin' ? (Math.random() * 1.6 - 0.8) : 0;

    const t = targetY / vy;
    const vz = (4.9 * t * t - 2.2) / t;
    const ax = swingRate;
    const vx = (targetX - 0.5 * ax * t * t) / t;

    setBall({
      x: 0, y: 0, z: 2.2,
      vx, vy, vz,
      ax, ay: -0.04, az: gravity,
      spin: spinRate, swing: swingRate,
      bounced: false, hit: false, isStumpHit: false, isOut: false
    });
  };

  // AI Batsman simulation
  const triggerAIBatsmanSwing = (targetX: number, targetY: number, speedKph: number, vy: number) => {
    const arrivalTime = 20.12 / vy; // total seconds to travel length of pitch
    
    // Choose randomized timing delay based on difficulty
    let timingSkew = 0;
    const diff = difficultyRef.current;
    if (diff === 'easy') {
      timingSkew = (Math.random() * 0.12 - 0.04); // Easy AI commits errors
    } else if (diff === 'medium') {
      timingSkew = (Math.random() * 0.05 - 0.015);
    } else {
      timingSkew = (Math.random() * 0.02 - 0.005); // Legend AI rarely misses
    }

    const optimalSwingWait = arrivalTime * 1000 + timingSkew * 1000;
    
    setTimeout(() => {
      if (bowlStageRef.current === 'released' && !ballRef.current.hit) {
        swingBatAI();
      }
    }, Math.max(100, optimalSwingWait - 80)); // schedule slightly before arrival for batting swing range
  };

  const swingBatAI = () => {
    const currentBall = ballRef.current;
    
    // Choose smart shot direction based on where the ball is pitched
    let chosenDirection = 0;
    if (currentBall.x < -0.15) {
      // Off side ball -> play to off-side (-80 to -15 degrees)
      chosenDirection = -80 + Math.random() * 65;
    } else if (currentBall.x > 0.15) {
      // Leg side ball -> play to leg-side (15 to 80 degrees)
      chosenDirection = 15 + Math.random() * 65;
    } else {
      // Straight delivery -> play dynamic drive (-30 to 30 degrees)
      chosenDirection = -30 + Math.random() * 60;
    }

    // Dynamic loft decision depending on difficulty
    let loftChance = 0.3;
    const diff = difficultyRef.current;
    if (diff === 'easy') {
      loftChance = 0.15;
    } else if (diff === 'medium') {
      loftChance = 0.35;
    } else {
      loftChance = 0.5; // Competitive hard / legend AI
    }
    
    const chosenLoft = Math.random() < loftChance;

    setBatShotDirection(chosenDirection);
    setBatLoft(chosenLoft);
    setBatStage('swung');
    setBatSwingTime(Date.now());
  };

  // Trigger Batsman Swing for User Batting
  const swingBat = () => {
    if (batStage !== 'ready') return;
    setBatStage('swung');
    setBatSwingTime(Date.now());

    if (isMultiplayer && mpEmitAction) {
      mpEmitAction('batsman_swing', {});
    }
  };

  // Create sparks or grass dust particle effects
  const createParticles = (x: number, y: number, z: number, color: string, count: number = 15, sizeScale: number = 1) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        x, y, z,
        vx: (Math.random() * 4 - 2),
        vy: (Math.random() * 4 - 2),
        vz: (Math.random() * 5 + 1),
        color,
        size: (Math.random() * 3 + 1.5) * sizeScale,
        alpha: 1,
        life: 0,
        maxLife: 30 + Math.floor(Math.random() * 30)
      });
    }
    setParticles(prev => [...prev, ...newParticles].slice(0, 150)); // limit total particles
  };

  // Wicket shatter particle effect
  const triggerStumpExplosion = () => {
    audioEngine.playStumpCrash();
    setStumpStatus({
      bailsFlipped: true,
      leftStumpAngle: (Math.random() * 15 - 7.5),
      midStumpAngle: (Math.random() * 10 - 5),
      rightStumpAngle: (Math.random() * 15 - 7.5),
      stumpShatterParticles: true
    });
    // Create bright splinters
    createParticles(0, 20.12, 0.4, '#FCE883', 35, 1.5);
    createParticles(0.1, 20.12, 0.8, '#FF5533', 15, 1.0); // glowing bails
    createParticles(-0.1, 20.12, 0.8, '#FF5533', 15, 1.0);
  };

  // Running mechanics
  const toggleRunning = () => {
    if (batStage !== 'running') {
      setBatStage('running');
      setIsRunning(true);
      setBatsmanDirection(1);
      setRunsScoredThisBall(0);
      setTotalRunsAttempted(1);
    } else {
      // Toggle back or call next run
      if (isRunning) {
        // Stop run
        setIsRunning(false);
      } else {
        setIsRunning(true);
        setBatsmanDirection(prev => (prev === 1 ? -1 : 1) as 1 | -1);
        setTotalRunsAttempted(prev => prev + 1);
      }
    }
  };

  // Stop Running button click handler
  const stopRunning = () => {
    setIsRunning(false);
  };

  const completeBallCycle = useCallback((
    runs: number, 
    out: boolean, 
    reason?: string,
    speedVal?: number,
    pitchXVal?: number,
    pitchYVal?: number,
    angleVal?: number,
    distVal?: number
  ) => {
    setIsBallActive(false);
    setBowlStage('completed');
    setIsRunning(false);
    
    // Play crowd cheering for boundaries or sigh for wicket
    if (out) {
      audioEngine.playWicketSigh();
    } else if (runs === 4 || runs === 6) {
      audioEngine.playBoundaryCheer();
    }

    if (isMultiplayer && isUserBatting && mpEmitAction) {
      mpEmitAction('sync_ball_result', {
        runs,
        isWicket: out,
        outReason: reason
      });
    }

    onBallCompleted(
      runs,
      out,
      reason,
      speedVal !== undefined ? speedVal : ball.vy * 3.6,
      bowlingTypeSelected,
      pitchXVal !== undefined ? pitchXVal : ball.pitchPoint?.x,
      pitchYVal !== undefined ? pitchYVal : ball.pitchPoint?.y,
      angleVal !== undefined ? angleVal : ball.shotAngle,
      distVal !== undefined ? distVal : ball.shotDistance
    );
  }, [ball, bowlingTypeSelected, onBallCompleted, isMultiplayer, isUserBatting, mpEmitAction]);

  const triggerBallResult = useCallback((
    runs: number, 
    out: boolean, 
    reason?: string, 
    delay: number = 0, 
    onTrigger?: () => void
  ) => {
    if (hasTriggeredResultRef.current) return;
    hasTriggeredResultRef.current = true;
    
    const speedVal = ball.vy * 3.6;
    const pitchXVal = ball.pitchPoint?.x;
    const pitchYVal = ball.pitchPoint?.y;
    const angleVal = ball.shotAngle;
    const distVal = ball.shotDistance;

    if (onTrigger) {
      onTrigger();
    }
    
    if (delay > 0) {
      setTimeout(() => {
        completeBallCycle(runs, out, reason, speedVal, pitchXVal, pitchYVal, angleVal, distVal);
      }, delay);
    } else {
      completeBallCycle(runs, out, reason, speedVal, pitchXVal, pitchYVal, angleVal, distVal);
    }
  }, [completeBallCycle, ball]);

  // Stable refs to prevent stale closure and effect cleanup issues
  const ballRef = useRef(ball);
  ballRef.current = ball;

  const bowlStageRef = useRef(bowlStage);
  bowlStageRef.current = bowlStage;

  const isBallActiveRef = useRef(isBallActive);
  isBallActiveRef.current = isBallActive;

  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  const batsmanDirectionRef = useRef(batsmanDirection);
  batsmanDirectionRef.current = batsmanDirection;

  const currentRunningDistanceRef = useRef(currentRunningDistance);
  currentRunningDistanceRef.current = currentRunningDistance;

  const runsScoredThisBallRef = useRef(runsScoredThisBall);
  runsScoredThisBallRef.current = runsScoredThisBall;

  const difficultyRef = useRef(difficulty);
  difficultyRef.current = difficulty;

  const triggerBallResultRef = useRef(triggerBallResult);
  triggerBallResultRef.current = triggerBallResult;

  const throwBallToCreaseRef = useRef<any>(null);

  // Main high-fidelity physics & fielding updates inside RequestAnimationFrame
  useEffect(() => {
    if (!isBallActive) return;

    let animId: number;
    let lastTime = performance.now();

    const updatePhysics = (time: number) => {
      const dt = Math.min(0.02, (time - lastTime) / 1000); // safety cap
      lastTime = time;

      setBall(prev => {
        let { x, y, z, vx, vy, vz, ax, ay, az, spin, swing, bounced, hit, isStumpHit, isOut } = prev;

        if (!hit) {
          // Ball in flight towards batsman
          x += vx * dt;
          y += vy * dt;
          z += vz * dt;

          // Apply air resistance & swing/spin curl
          vx += ax * dt;
          vy += ay * dt;
          vz += az * dt;

          // Check pitch bounce (Z <= 0.05 representing ball diameter / turf level)
          if (z <= 0.06 && !bounced && vy > 0) {
            bounced = true;
            z = 0.06;
            vz = -vz * 0.72; // bounce coefficient
            
            // Apply Spin drift
            vx += spin * 2.4; 
            
            // Save Pitch position
            prev.pitchPoint = { x, y };
            
            // Emit pitch dust particles
            createParticles(x, y, 0.05, '#E2D3B7', 10, 0.8);
          }

          // Check Stump hit
          // Stump coordinates: around X = -0.15m to 0.15m, Y = 20.12m, Z <= 0.8m
          if (y >= 20.12 && y <= 20.4 && z <= 0.78 && Math.abs(x) <= 0.18) {
            isStumpHit = true;
            isOut = true;
            if (!hasTriggeredResultRef.current) {
              triggerBallResult(0, true, 'Bowled', 2500, () => {
                triggerStumpExplosion();
                setIsWicketAnimationActive(true);
              });
            }
            return { ...prev, isStumpHit, isOut, y: 20.12 };
          }

          // Check if missed completely (passed batsman crease Y = 20.5m)
          if (y >= 21.0) {
            triggerBallResult(0, false, undefined, 1000);
            return { ...prev, y: 21.0 };
          }

          // Bat swing contact calculation
          if (batStage === 'swung' && batSwingTime && !hit) {
            // The arrival Y of the ball is at the batsman crease (Y = 19.5m to 20.1m)
            const batsmanCreaseY = 19.8;
            if (y >= batsmanCreaseY - 0.8 && y <= batsmanCreaseY + 0.5) {
              const actualArrival = time;
              // Timing offset
              const timeDiff = Math.abs(prev.y - batsmanCreaseY) / vy; // seconds away
              
              // Evaluate timing
              let timingLabel = 'Perfect';
              let timingColor = 'text-green-400';
              let accuracyMultiplier = 1.0;

              if (timeDiff < 0.05) {
                timingLabel = 'Perfect';
                timingColor = 'text-emerald-400 shadow-emerald-500/50';
                accuracyMultiplier = 1.3;
              } else if (timeDiff < 0.12) {
                timingLabel = 'Good';
                timingColor = 'text-green-400';
                accuracyMultiplier = 0.95;
              } else if (timeDiff < 0.22) {
                timingLabel = 'Early / Late';
                timingColor = 'text-yellow-400';
                accuracyMultiplier = 0.6;
              } else {
                timingLabel = 'Too Early / Late';
                timingColor = 'text-red-400';
                accuracyMultiplier = 0.15;
              }

              // Evaluate if hit connected
              const batsmanRatingFactor = activeBatsman.battingRating / 100;
              const hitSuccessChance = 0.35 + batsmanRatingFactor * 0.45 * accuracyMultiplier;

              if (Math.random() <= hitSuccessChance && accuracyMultiplier > 0.15) {
                // SUCCESSFUL HIT
                hit = true;
                setBatStage('running');
                setViewMode('fielding'); // Immediately switch camera to aerial field view!
                setBatTimingLabel(timingLabel + ' Stroke!');
                setBatTimingColor(timingColor);
                audioEngine.playBatHit(accuracyMultiplier);

                // Auto run for AI Batsman if user is bowling
                if (!isUserBatting) {
                  setIsRunning(true);
                  setBatsmanDirection(1);
                  setRunsScoredThisBall(0);
                  setTotalRunsAttempted(1);
                }

                // Compute exit vector based on selected shot direction & timing
                // The angle the player directed (batShotDirection: -90 to 90) plus swing timing offset
                const shotAngleRad = (batShotDirection + (Math.random() * 15 - 7.5)) * Math.PI / 180;
                
                // Exit speeds matching cricket realities
                const ballSpeedKph = Math.sqrt(vx * vx + vy * vy + vz * vz) * 3.6;
                const exitSpeedKph = (ballSpeedKph * 0.85 + 40) * accuracyMultiplier * (batLoft ? 1.15 : 0.9);
                const exitVelocity = exitSpeedKph / 3.6;

                // Set new vectors (shot angle: 0 is straight forward Y=0, so Vy is negative)
                // Wait! Straight hit goes back towards bowler end, which is y coordinate DECREASING!
                // So: Vy should be negative!
                vx = Math.sin(shotAngleRad) * exitVelocity;
                vy = -Math.cos(shotAngleRad) * exitVelocity;
                vz = batLoft ? (6 + Math.random() * 8) * accuracyMultiplier : (0.2 + Math.random() * 1.5);

                const shotDistance = (exitVelocity * exitVelocity * Math.sin(2 * 40 * Math.PI / 180)) / 9.8; // simple trajectory formula estimate

                // Emit sparks at contact point
                createParticles(x, y, z, '#FFFFFF', 20, 1.2);

                return {
                  ...prev,
                  hit,
                  vx, vy, vz,
                  ax: 0, ay: -0.015, az: -9.8, // standard physics in air after hitting
                  bounced: false,
                  shotAngle: batShotDirection,
                  shotPower: exitSpeedKph,
                  shotDistance: Math.round(shotDistance)
                };
              } else {
                // Swung and missed, or thick edge
                if (Math.random() < 0.25) {
                  // Thick Edge behind wicket
                  hit = true;
                  setBatStage('running');
                  setViewMode('fielding');
                  setBatTimingLabel('Thick Edge!');
                  setBatTimingColor('text-orange-400');
                  audioEngine.playBatHit(0.35);

                  // Auto run for AI Batsman if user is bowling
                  if (!isUserBatting) {
                    setIsRunning(true);
                    setBatsmanDirection(1);
                    setRunsScoredThisBall(0);
                    setTotalRunsAttempted(1);
                  }

                  const edgeAngleRad = (-125 + Math.random() * 50) * Math.PI / 180; // goes to slip/keeper
                  const ballSpeedKph = Math.sqrt(vx * vx + vy * vy + vz * vz) * 3.6;
                  const exitVelocity = (ballSpeedKph / 3.6) * 0.4;
                  vx = Math.sin(edgeAngleRad) * exitVelocity;
                  vy = Math.cos(edgeAngleRad) * exitVelocity; // positive Vy means goes behind keeper
                  vz = 3.5 + Math.random() * 4;

                  return {
                    ...prev, hit, vx, vy, vz, ax: 0, ay: -0.01, az: -9.8, bounced: false
                  };
                } else {
                  setBatTimingLabel('Missed Stroke!');
                  setBatTimingColor('text-red-400');
                }
              }
            }
          }
        } else {
          // Ball is hit! Traveling in the field (aerial projection or rolling)
          x += vx * dt;
          y += vy * dt;
          z += vz * dt;

          // Decelerations
          vx += ax * dt;
          vy += ay * dt;
          vz += az * dt;

          // Check bounce off grass in outfield
          if (z <= 0.04) {
            z = 0.04;
            vz = -vz * 0.45; // lower bounce in outfield
            
            // Grass friction
            vx *= 0.85;
            vy *= 0.85;

            // Stop ball if rolling very slowly
            if (Math.abs(vx) < 0.2 && Math.abs(vy) < 0.2 && Math.abs(vz) < 0.2) {
              vx = 0;
              vy = 0;
              vz = 0;
            }
          }

          // Check Boundary crossing
          // Field size boundary: ~70 meters radius from center (0, 10)
          const distFromPitchCenter = Math.sqrt(x * x + (y - 10) * (y - 10));
          if (distFromPitchCenter >= 62) {
            // BOUNDARY REACHED
            const runsAwarded = z > 1.2 ? 6 : 4;
            setRunsScoredThisBall(runsAwarded);
            triggerBallResult(runsAwarded, false, undefined, 800);
            return { ...prev, vx: 0, vy: 0, vz: 0, z: 0.1 };
          }
        }

        return { ...prev, x, y, z, vx, vy, vz, bounced };
      });

      animId = requestAnimationFrame(updatePhysics);
    };

    animId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animId);
  }, [isBallActive, batStage, batSwingTime, batShotDirection, batLoft, triggerBallResult]);

  // Fielding AI & Runs updates
  useEffect(() => {
    if (!isBallActive || !ballRef.current.hit || isThrownBack) return;

    const interval = setInterval(() => {
      const currentBall = ballRef.current;

      // Update fielders positions (Steer towards ball)
      setFielders(prev => {
        // Find closest fielder to the ball
        let closestIdx = 0;
        let minDist = 9999;

        prev.forEach((fielder, idx) => {
          const d = Math.sqrt((fielder.x - currentBall.x) ** 2 + (fielder.y - currentBall.y) ** 2);
          if (d < minDist) {
            minDist = d;
            closestIdx = idx;
          }
        });

        return prev.map((f, idx) => {
          if (idx === closestIdx && f.state !== 'throwing') {
            // Sprint to ball
            const dx = currentBall.x - f.x;
            const dy = currentBall.y - f.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 1.2) {
              const isBallStopped = currentBall.vx === 0 && currentBall.vy === 0;
              const sprintSpeed = isBallStopped ? 11.0 : 8.5; // faster dynamic sprint speed
              const vx = (dx / dist) * sprintSpeed;
              const vy = (dy / dist) * sprintSpeed;
              return {
                ...f,
                x: f.x + vx * 0.1,
                y: f.y + vy * 0.1,
                vx, vy,
                state: 'chasing'
              };
            } else {
              // Ball caught or picked up!
              const isFlyCatch = currentBall.z > 0.4 && currentBall.z < 2.5 && minDist < 1.8 && !currentBall.bounced;
              if (isFlyCatch) {
                clearInterval(interval);
                triggerBallResultRef.current(0, true, 'Caught by ' + f.name, 600, () => {
                  setIsWicketAnimationActive(true);
                });
                return { ...f, state: 'done' as const };
              }

              // Standard ground pickup & Throw back to wicket
              if (!hasTriggeredResultRef.current) {
                setTimeout(() => {
                  if (throwBallToCreaseRef.current) {
                    throwBallToCreaseRef.current(f);
                  }
                }, 200);
              }

              return { ...f, state: 'throwing' as const };
            }
          }
          return f;
        });
      });

      // Update Batsman runs if running
      if (isRunningRef.current) {
        // If AI is batting, make dynamic decisions on whether to stop running to avoid being run out
        if (!isUserBatting) {
          const isBallComingBack = isThrownBack || fielders.some(f => f.state === 'throwing');
          if (isBallComingBack) {
            const currentDistance = currentRunningDistanceRef.current;
            if (currentDistance >= 0.90 || currentDistance <= 0.10) {
              setIsRunning(false);
            }
          }
        }

        setCurrentRunningDistance(prev => {
          let next = prev + 0.05 * batsmanDirectionRef.current;
          
          // Check if crossed the other end crease (fraction reaches 1 or 0)
          if (batsmanDirectionRef.current === 1 && next >= 1.0) {
            next = 1.0;
            // Cross crease! Run scored!
            setRunsScoredThisBall(r => r + 1);
            
            // AI running decision for next run
            if (!isUserBatting) {
              const currentBall = ballRef.current;
              const isBallComingBack = isThrownBack || fielders.some(f => f.state === 'throwing');
              const distFromWickets = Math.sqrt(currentBall.x * currentBall.x + Math.min(currentBall.y, Math.abs(20.12 - currentBall.y)) ** 2);
              
              if (isBallComingBack || distFromWickets < 18 || Math.random() < 0.25) {
                // Not safe to take another, stay inside crease
                setIsRunning(false);
              } else {
                // Push for next run!
                setBatsmanDirection(-1);
                batsmanDirectionRef.current = -1;
                setTotalRunsAttempted(prevRuns => prevRuns + 1);
                audioEngine.playBatHit(0.2); // slight thud for bat tap on crease
              }
            } else {
              setBatsmanDirection(-1);
              batsmanDirectionRef.current = -1;
              setTotalRunsAttempted(prevRuns => prevRuns + 1);
              audioEngine.playBatHit(0.2); // slight thud for bat tap on crease
            }
          } else if (batsmanDirectionRef.current === -1 && next <= 0.0) {
            next = 0.0;
            setRunsScoredThisBall(r => r + 1);
            
            // AI running decision for next run
            if (!isUserBatting) {
              const currentBall = ballRef.current;
              const isBallComingBack = isThrownBack || fielders.some(f => f.state === 'throwing');
              const distFromWickets = Math.sqrt(currentBall.x * currentBall.x + Math.min(currentBall.y, Math.abs(20.12 - currentBall.y)) ** 2);
              
              if (isBallComingBack || distFromWickets < 18 || Math.random() < 0.25) {
                // Not safe to take another, stay inside crease
                setIsRunning(false);
              } else {
                setBatsmanDirection(1);
                batsmanDirectionRef.current = 1;
                setTotalRunsAttempted(prevRuns => prevRuns + 1);
                audioEngine.playBatHit(0.2);
              }
            } else {
              setBatsmanDirection(1);
              batsmanDirectionRef.current = 1;
              setTotalRunsAttempted(prevRuns => prevRuns + 1);
              audioEngine.playBatHit(0.2);
            }
          }
          return next;
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isBallActive, ball.hit, isThrownBack]);

  // Throw ball back to pitch stumps (Run-out risk!)
  const throwBallToCrease = (fielder: typeof fielders[0]) => {
    if (hasTriggeredResultRef.current) return;
    setIsThrownBack(true);
    const currentBall = ballRef.current;
    // Determine target stumps based on distance: throw to keeper (Y=20) or bowler (Y=0)
    const targetY = currentBall.y > 10 ? 20.12 : 0;
    const throwTimeSec = Math.max(0.4, Math.sqrt(fielder.x * fielder.x + (fielder.y - targetY) ** 2) / 25); // faster throw velocity

    // Move ball immediately in flight back to stumps
    setBall(prev => ({
      ...prev,
      x: fielder.x,
      y: fielder.y,
      z: 0.1,
      vx: (0 - fielder.x) / throwTimeSec,
      vy: (targetY - fielder.y) / throwTimeSec,
      vz: 4.5,
      ax: 0, ay: 0, az: -9.8,
      bounced: true
    }));

    // Trigger run-out check after ball arrival
    setTimeout(() => {
      if (hasTriggeredResultRef.current) return;
      // Evaluate if batsman is safe inside the crease line
      // Safe zone is: running distance > 0.88 or < 0.12 depending on end.
      const isBatsmanSafe = currentRunningDistanceRef.current > 0.88 || currentRunningDistanceRef.current < 0.12 || !isRunningRef.current;

      const randomDirectHit = Math.random() <= (difficultyRef.current === 'easy' ? 0.35 : (difficultyRef.current === 'medium' ? 0.6 : 0.85));

      if (!isBatsmanSafe && randomDirectHit) {
        // RUN OUT!
        triggerBallResultRef.current(0, true, 'Run Out', 0, () => {
          triggerStumpExplosion();
          setIsWicketAnimationActive(true);
        });
      } else {
        // Safe, collect remaining runs
        triggerBallResultRef.current(runsScoredThisBallRef.current, false);
      }
    }, throwTimeSec * 1000);
  };

  throwBallToCreaseRef.current = throwBallToCrease;

  // Dynamic particle effects tick
  useEffect(() => {
    const pInterval = setInterval(() => {
      setParticles(prev => prev.map(p => {
        return {
          ...p,
          x: p.x + p.vx * 0.03,
          y: p.y + p.vy * 0.03,
          z: Math.max(0, p.z + p.vz * 0.03),
          vz: p.vz - 9.8 * 0.03, // gravity
          alpha: Math.max(0, 1 - p.life / p.maxLife),
          life: p.life + 1
        };
      }).filter(p => p.life < p.maxLife));
    }, 30);
    return () => clearInterval(pInterval);
  }, []);

  // Primary Canvas drawing engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      // Setup canvas scale based on screen
      const width = canvas.width = canvas.parentElement?.clientWidth || 800;
      const height = canvas.height = 420;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Define camera configs dynamically
      let camera = { x: 0, y: 23, z: 1.6 }; // Batting camera default
      if (viewMode === 'bowling') {
        camera = { x: 0, y: -4, z: 2.1 }; // Behind bowler looking forward
      } else if (viewMode === 'fielding') {
        camera = { x: 0, y: 10, z: 45 }; // High overhead field view
      }

      // Draw Stadium & Sky Gradient
      let skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (stadiumTimeOfDay === 'Day') {
        skyGrad.addColorStop(0, '#7bc6ff');
        skyGrad.addColorStop(1, '#a6d9ff');
      } else if (stadiumTimeOfDay === 'Twilight') {
        skyGrad.addColorStop(0, '#11002e');
        skyGrad.addColorStop(0.5, '#441151');
        skyGrad.addColorStop(1, '#bd485a');
      } else {
        skyGrad.addColorStop(0, '#040915');
        skyGrad.addColorStop(1, '#0e182e');
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Helper function for 3D coordinate projection
      const project3D = (x: number, y: number, z: number) => {
        if (viewMode === 'fielding') {
          // Bird's eye projection map
          const fieldScale = 2.6; // pixels per meter
          const sx = centerX + x * fieldScale;
          const sy = centerY + (y - 10) * fieldScale;
          return { x: sx, y: sy, depth: 1 };
        }

        // Perspective 3D calculation
        const dx = x - camera.x;
        const dy = viewMode === 'batting' ? (camera.y - y) : (y - camera.y);
        const dz = z - camera.z;

        if (dy <= 0.2) return { x: -9999, y: -9999, depth: 0 }; // Behind camera

        const focalLength = 380; // FOV zoom factor
        const sx = centerX + (dx * focalLength) / dy;
        const sy = centerY + 100 - (dz * focalLength) / dy; // shift pitch line downwards

        return { x: sx, y: sy, depth: dy };
      };

      // Draw Stadium Stands / Spectators
      if (viewMode !== 'fielding') {
        // High stands left and right in background
        ctx.fillStyle = stadiumTimeOfDay === 'Night' ? '#070b13' : '#14213d';
        ctx.beginPath();
        ctx.moveTo(0, height * 0.7);
        ctx.quadraticCurveTo(centerX, height * 0.4, width, height * 0.7);
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.fill();

        // Spectator colored seats (rows of dynamic small dots)
        ctx.fillStyle = '#fce883';
        for (let i = 10; i < width; i += 12) {
          const curveY = height * 0.58 + Math.sin(i / 100) * 12;
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = i % 2 === 0 ? '#ff5533' : '#33ccff';
          ctx.fillRect(i, curveY, 3, 3);
          ctx.fillRect(i + 4, curveY + 8, 3, 3);
        }
        ctx.globalAlpha = 1.0;

        // Massive Stadium Light Towers
        const drawLightTower = (lx: number, ly: number, size: number) => {
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx - 10, ly + 140);
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx + 10, ly + 140);
          ctx.stroke();

          // Lights glow panel
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 30;
          ctx.beginPath();
          ctx.arc(lx, ly, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0; // reset
        };

        drawLightTower(45, 50, 16);
        drawLightTower(width - 45, 50, 16);
      }

      // Draw Cricket Ground Outfield Boundary (Circular ring)
      if (viewMode === 'fielding') {
        // Draw Outfield Green turf Circle
        const boundaryRadius = 60 * 2.6; // 60 meters radius scaled
        ctx.fillStyle = '#1e3a1e'; // deep grass green
        ctx.beginPath();
        ctx.arc(centerX, centerY, boundaryRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw boundary rope ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, boundaryRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw 30-yard inner circle
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 27.4 * 2.6, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Outfield Green Ground projection
        let outfieldGrad = ctx.createLinearGradient(0, centerY, 0, height);
        outfieldGrad.addColorStop(0, '#14532d'); // dark green
        outfieldGrad.addColorStop(1, '#166534'); // vibrant turf green
        ctx.fillStyle = outfieldGrad;
        ctx.beginPath();
        ctx.moveTo(0, height * 0.5);
        ctx.lineTo(width, height * 0.5);
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.fill();
      }

      // Draw 22-Yard Cricket Pitch
      // Pitch coords: X width (-1.5 to 1.5), Y length (0 to 20.12m)
      if (viewMode !== 'fielding') {
        const p1 = project3D(-1.3, 0, 0); // Bowler Left
        const p2 = project3D(1.3, 0, 0);  // Bowler Right
        const p3 = project3D(1.3, 20.12, 0); // Batsman Right
        const p4 = project3D(-1.3, 20.12, 0); // Batsman Left

        if (p1.depth > 0 && p3.depth > 0) {
          // Soft sand/clay brown center pitch texture
          ctx.fillStyle = '#eae1c5';
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.lineTo(p3.x, p3.y);
          ctx.lineTo(p4.x, p4.y);
          ctx.closePath();
          ctx.fill();

          // Crease Lines: Pop crease Y = 19.12m, Bowler crease Y = 1m
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = 2;
          
          const popLeft = project3D(-1.3, 19.0, 0);
          const popRight = project3D(1.3, 19.0, 0);
          ctx.beginPath();
          ctx.moveTo(popLeft.x, popLeft.y);
          ctx.lineTo(popRight.x, popRight.y);
          ctx.stroke();
        }
      } else {
        // Draw pitch in middle of birds-eye map
        ctx.fillStyle = '#eae1c5';
        ctx.fillRect(centerX - 4, centerY - 25, 8, 50);
      }

      // Draw Stumps & Wickets
      // Batsman stumps are at Y = 20.12m. Bowler stumps at Y = 0m
      const drawStumps = (yPos: number) => {
        const stumpSpacing = 0.08; // meters
        const stumpHeight = 0.71; // meters

        for (let idx = -1; idx <= 1; idx++) {
          const sx = idx * stumpSpacing;
          const topProj = project3D(sx, yPos, stumpHeight);
          const baseProj = project3D(sx, yPos, 0);

          if (baseProj.depth > 0) {
            ctx.strokeStyle = '#fca5a5'; // stumps color
            ctx.lineWidth = viewMode === 'fielding' ? 1 : Math.max(1.5, 12 / baseProj.depth);
            
            // Check tilt for wicket animation
            let angle = 0;
            if (yPos === 20.12 && stumpStatus.bailsFlipped) {
              if (idx === -1) angle = stumpStatus.leftStumpAngle;
              if (idx === 0) angle = stumpStatus.midStumpAngle;
              if (idx === 1) angle = stumpStatus.rightStumpAngle;
            }

            if (angle !== 0) {
              // Draw rotated stump
              ctx.save();
              ctx.translate(baseProj.x, baseProj.y);
              ctx.rotate((angle * Math.PI) / 180);
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(0, -(stumpHeight * 380) / baseProj.depth);
              ctx.stroke();
              ctx.restore();
            } else {
              ctx.beginPath();
              ctx.moveTo(baseProj.x, baseProj.y);
              ctx.lineTo(topProj.x, topProj.y);
              ctx.stroke();
            }
          }
        }

        // Draw horizontal bails on top
        if (!stumpStatus.bailsFlipped || yPos === 0) {
          const lProj = project3D(-stumpSpacing - 0.02, yPos, stumpHeight + 0.02);
          const rProj = project3D(stumpSpacing + 0.02, yPos, stumpHeight + 0.02);
          if (lProj.depth > 0) {
            ctx.strokeStyle = '#ef4444'; // Glowing bails red
            ctx.lineWidth = Math.max(1, 6 / lProj.depth);
            ctx.beginPath();
            ctx.moveTo(lProj.x, lProj.y);
            ctx.lineTo(rProj.x, rProj.y);
            ctx.stroke();
          }
        }
      };

      if (viewMode !== 'fielding') {
        drawStumps(0);      // bowler's end stumps
        drawStumps(20.12);  // batsman's end stumps
      }

      // Draw Aim/Target marker overlay when bowling
      if (bowlStage === 'aiming' && viewMode === 'bowling' && !isUserBatting) {
        const aimProj = project3D(aimMarker.x, aimMarker.y, 0);
        if (aimProj.depth > 0) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(aimProj.x, aimProj.y, Math.max(8, 65 / aimProj.depth), 0, Math.PI * 2);
          ctx.stroke();

          // Crosshair
          ctx.beginPath();
          ctx.moveTo(aimProj.x - 10, aimProj.y);
          ctx.lineTo(aimProj.x + 10, aimProj.y);
          ctx.moveTo(aimProj.x, aimProj.y - 10);
          ctx.lineTo(aimProj.x, aimProj.y + 10);
          ctx.stroke();
        }
      }

      // Draw AI/User Bowler (Vector Character)
      if (viewMode !== 'fielding') {
        const bowlerY = isBallActive ? Math.min(2.0, ball.y) : -1.5;
        const bProj = project3D(0.2, bowlerY, 1.85);
        if (bProj.depth > 0 && bProj.y > 0) {
          // Draw bowler jersey
          ctx.fillStyle = bowlingTeam.primaryColor;
          ctx.beginPath();
          ctx.arc(bProj.x, bProj.y, Math.max(6, 60 / bProj.depth), 0, Math.PI * 2); // head
          ctx.fill();

          // Torso
          ctx.fillStyle = bowlingTeam.secondaryColor;
          ctx.fillRect(bProj.x - Math.max(4, 40 / bProj.depth), bProj.y + Math.max(6, 60 / bProj.depth), Math.max(8, 80 / bProj.depth), Math.max(12, 120 / bProj.depth));
        }
      }

      // Draw Wicket Keeper
      if (viewMode === 'batting' || viewMode === 'bowling') {
        const keeperProj = project3D(0, 22.0, 1.1); // sits behind batsman stumps
        if (keeperProj.depth > 0 && keeperProj.y > 0) {
          ctx.fillStyle = bowlingTeam.primaryColor;
          ctx.beginPath();
          ctx.arc(keeperProj.x, keeperProj.y, Math.max(5, 50 / keeperProj.depth), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Batsman (Vector Player holding dynamic bat)
      if (viewMode !== 'fielding') {
        const bX = 0.4;
        const bY = 19.8; // batsman stance position
        const batProj = project3D(bX, bY, 1.8);

        if (batProj.depth > 0 && batProj.y > 0) {
          // Helmet
          ctx.fillStyle = battingTeam.secondaryColor;
          ctx.beginPath();
          ctx.arc(batProj.x, batProj.y, Math.max(7, 75 / batProj.depth), 0, Math.PI * 2);
          ctx.fill();

          // Jersey body
          ctx.fillStyle = battingTeam.primaryColor;
          ctx.beginPath();
          ctx.moveTo(batProj.x - Math.max(6, 60 / batProj.depth), batProj.y + Math.max(8, 80 / batProj.depth));
          ctx.lineTo(batProj.x + Math.max(6, 60 / batProj.depth), batProj.y + Math.max(8, 80 / batProj.depth));
          ctx.lineTo(batProj.x + Math.max(9, 90 / batProj.depth), batProj.y + Math.max(28, 280 / batProj.depth));
          ctx.lineTo(batProj.x - Math.max(9, 90 / batProj.depth), batProj.y + Math.max(28, 280 / batProj.depth));
          ctx.closePath();
          ctx.fill();

          // Draw the Bat (interactive tilt)
          ctx.strokeStyle = '#d97706'; // wood color
          ctx.lineWidth = Math.max(2, 22 / batProj.depth);

          const isSwinging = batStage === 'swung';
          const batAngle = isSwinging ? -(Math.PI / 3) : (Math.PI / 4); // swing down transition

          ctx.save();
          ctx.translate(batProj.x, batProj.y + Math.max(15, 150 / batProj.depth));
          ctx.rotate(batAngle);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, Math.max(18, 180 / batProj.depth)); // bat length
          ctx.stroke();
          ctx.restore();
        }
      }

      // Draw Cricket Ball with trail particles!
      const ballProj = project3D(ball.x, ball.y, ball.z);
      if (isBallActive && ballProj.depth > 0) {
        // Draw trailing ghost balls
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#ef4444'; // real leather red
        
        // Render current ball
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        const ballSize = viewMode === 'fielding' ? 4 : Math.max(3.5, 45 / ballProj.depth);
        ctx.arc(ballProj.x, ballProj.y, ballSize, 0, Math.PI * 2);
        ctx.fill();

        // Seam detailing on ball if close
        if (ballProj.depth < 8 && viewMode !== 'fielding') {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(ballProj.x, ballProj.y, ballSize, -Math.PI/3, Math.PI/3);
          ctx.stroke();
        }
      }

      // Draw running batsman on the pitch (Y=0 to 20.12m)
      if (viewMode === 'fielding') {
        // Draw Striker running
        const strikerY = 19.8 - currentRunningDistance * 19.8;
        const strikerProj = project3D(0.4, strikerY, 0.4);
        ctx.fillStyle = battingTeam.primaryColor;
        ctx.beginPath();
        ctx.arc(strikerProj.x, strikerProj.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Draw Non-Striker running opposite
        const nonStrikerY = currentRunningDistance * 19.8;
        const nonStrikerProj = project3D(-0.4, nonStrikerY, 0.4);
        ctx.fillStyle = battingTeam.primaryColor;
        ctx.beginPath();
        ctx.arc(nonStrikerProj.x, nonStrikerProj.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Fielders on Wide Fielding View
      if (viewMode === 'fielding') {
        fielders.forEach((f) => {
          const fProj = project3D(f.x, f.y, 0.5);
          
          // Draw fielder jersey dot
          ctx.fillStyle = bowlingTeam.primaryColor;
          ctx.beginPath();
          ctx.arc(fProj.x, fProj.y, 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Cap / Highlight
          ctx.fillStyle = bowlingTeam.secondaryColor;
          ctx.beginPath();
          ctx.arc(fProj.x, fProj.y - 1.5, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Draw fielder name label
          ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.font = 'bold 8px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(f.name, fProj.x, fProj.y - 6);
        });
      }

      // Draw Particles System
      particles.forEach(p => {
        const pProj = project3D(p.x, p.y, p.z);
        if (pProj.depth > 0) {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(pProj.x, pProj.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      // Overlay Screen Text for Wickets
      if (isWicketAnimationActive) {
        ctx.fillStyle = 'rgba(220, 38, 38, 0.2)';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#ef4444';
        ctx.font = 'black 36px font-sans';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 10;
        ctx.fillText('WICKET!', centerX, centerY - 20);
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [viewMode, bowlStage, aimMarker, isBallActive, ball, batStage, particles, fielders, isWicketAnimationActive, currentRunningDistance]);

  return (
    <div className="flex flex-col gap-4 w-full" id="stadium-canvas-container">
      {/* Dynamic View Header / Timing Indicators */}
      <div className="flex items-center justify-between px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
            <Target size={13} className="text-red-400" /> Stadium View:
          </span>
          <div className="flex bg-neutral-950 p-1 rounded-md border border-neutral-800">
            <button 
              onClick={() => setViewMode('batting')} 
              className={`px-3 py-1 text-xs font-bold rounded transition-all ${viewMode === 'batting' ? 'bg-yellow-500 text-black' : 'text-neutral-400 hover:text-white'}`}
            >
              TV View
            </button>
            <button 
              onClick={() => setViewMode('fielding')} 
              className={`px-3 py-1 text-xs font-bold rounded transition-all ${viewMode === 'fielding' ? 'bg-yellow-500 text-black' : 'text-neutral-400 hover:text-white'}`}
            >
              Field Map
            </button>
          </div>
        </div>

        {/* Real-time Batting Timing Feedback */}
        {batTimingLabel && (
          <div className={`px-4 py-1.5 rounded-full bg-black/60 border border-white/10 font-black text-sm tracking-wide flex items-center gap-2 animate-bounce ${batTimingColor}`}>
            <Zap size={14} className="animate-pulse" /> {batTimingLabel}
          </div>
        )}
      </div>

      {/* Primary Canvas Container */}
      <div className="relative w-full border border-neutral-800/80 bg-neutral-950 rounded-xl overflow-hidden shadow-inner aspect-[21/9] md:aspect-[21/9]">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full block cursor-crosshair"
        />

        {/* Bowling target release meter (Overlay left) */}
        {!isUserBatting && bowlStage === 'power-meter' && (
          <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 bg-black/85 border border-neutral-800 p-3.5 rounded-xl shadow-2xl backdrop-blur">
            <span className="text-[9px] font-extrabold text-neutral-400 tracking-widest uppercase">Release Power</span>
            <div className="relative w-7 h-36 bg-neutral-900 rounded-full border border-neutral-700/80 overflow-hidden">
              <div 
                className="absolute bottom-0 w-full bg-gradient-to-t from-red-500 via-yellow-400 to-emerald-500 transition-all duration-75"
                style={{ height: `${bowlerPower}%` }}
              />
              {/* Sweet spot marker */}
              <div className="absolute bottom-[75%] w-full h-4 bg-emerald-400/30 border-y border-emerald-400 flex items-center justify-center">
                <span className="text-[8px] text-emerald-400 font-bold tracking-tighter">SWEET</span>
              </div>
            </div>
            <button 
              onClick={releaseBall}
              className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-xs rounded-lg flex items-center gap-1.5 transition shadow"
            >
              <Zap size={12} /> Deliver
            </button>
          </div>
        )}

        {/* Batting Direction Indicator (Right edge overlay) */}
        {isUserBatting && batStage === 'ready' && (
          <div className="absolute right-6 top-6 flex flex-col items-end gap-2 bg-black/85 border border-neutral-800 p-3 rounded-lg backdrop-blur">
            <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest">Shot Direction</span>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setBatShotDirection(prev => Math.max(-120, prev - 15))}
                className="p-1 bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 rounded-md text-xs font-mono font-bold"
                title="Aim Offside"
              >
                ◀ Off
              </button>
              <span className="text-xs font-black font-mono text-yellow-400 bg-neutral-900 border border-neutral-800 px-2 py-1 rounded">
                {batShotDirection === 0 ? 'Straight' : `${Math.abs(batShotDirection)}° ${batShotDirection < 0 ? 'Off' : 'Leg'}`}
              </span>
              <button 
                onClick={() => setBatShotDirection(prev => Math.min(120, prev + 15))}
                className="p-1 bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700 rounded-md text-xs font-mono font-bold"
                title="Aim Legside"
              >
                Leg ▶
              </button>
            </div>
            
            {/* Ground vs Loft toggler */}
            <div className="flex bg-neutral-900 border border-neutral-800 rounded p-0.5 w-full mt-1">
              <button 
                onClick={() => setBatLoft(false)} 
                className={`flex-1 py-0.5 text-[9px] font-black rounded uppercase ${!batLoft ? 'bg-neutral-700 text-white' : 'text-neutral-500'}`}
              >
                Grounded
              </button>
              <button 
                onClick={() => setBatLoft(true)} 
                className={`flex-1 py-0.5 text-[9px] font-black rounded uppercase ${batLoft ? 'bg-yellow-500 text-black' : 'text-neutral-500'}`}
              >
                Lofted
              </button>
            </div>
          </div>
        )}

        {/* Interactive Play Buttons for user */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
          {/* Bowling Start Runup Button */}
          {!isUserBatting && bowlStage === 'aiming' && (
            <button 
              onClick={startBowlingPowerMeter}
              className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl shadow-lg flex items-center gap-2 transform active:scale-95 transition"
            >
              <Play size={16} /> Start Bowling Delivery
            </button>
          )}

          {/* Batting Strike Button */}
          {isUserBatting && batStage === 'ready' && bowlStage === 'released' && (
            <button 
              onClick={swingBat}
              className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-black rounded-xl shadow-lg border border-red-500/20 uppercase tracking-wider flex items-center gap-2 animate-pulse transform active:scale-95 transition"
            >
              <Zap size={16} /> Strike Bat!
            </button>
          )}

          {/* Running Button */}
          {batStage === 'running' && (
            <div className="flex items-center gap-2 bg-neutral-950/95 border border-neutral-800 p-2 rounded-xl backdrop-blur-md shadow-2xl">
              <button 
                onClick={toggleRunning}
                className={`px-5 py-2.5 rounded-lg font-black text-xs uppercase flex items-center gap-1.5 transition-all ${
                  isRunning 
                    ? 'bg-orange-500 hover:bg-orange-400 text-white' 
                    : 'bg-green-600 hover:bg-green-500 text-white'
                }`}
              >
                <RefreshCw size={13} className={isRunning ? 'animate-spin' : ''} />
                {isRunning ? 'Turn / Push for Next' : 'Sprint Run'}
              </button>
              <button 
                onClick={stopRunning}
                className={`px-4 py-2.5 rounded-lg border border-neutral-800 font-bold text-xs uppercase hover:bg-neutral-900 transition ${
                  !isRunning ? 'bg-neutral-850 text-emerald-400' : 'text-neutral-400'
                }`}
              >
                Stay Safe
              </button>
            </div>
          )}

          {/* Auto AI bowling release guide */}
          {isUserBatting && bowlStage === 'aiming' && (
            <div className="flex flex-col items-center gap-1 text-center bg-black/85 px-4 py-2 rounded-lg border border-white/5">
              {isMultiplayer ? (
                <span className="text-[10px] font-bold text-neutral-400 animate-pulse">Waiting for online bowler to deliver...</span>
              ) : (
                <>
                  <span className="text-[10px] font-bold text-neutral-400">Waiting for AI delivery run-up...</span>
                  <button 
                    onClick={triggerAIBowler}
                    className="px-3 py-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black text-[10px] rounded"
                  >
                    Deliver Ball Now
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
