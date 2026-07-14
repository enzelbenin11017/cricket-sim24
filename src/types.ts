export interface Player {
  id: string;
  name: string;
  role: 'Batsman' | 'Bowler' | 'AllRounder' | 'WicketKeeper';
  battingStyle: 'Right-Hand' | 'Left-Hand';
  bowlingStyle: 'Fast-Pace' | 'Medium-Pace' | 'Off-Spin' | 'Leg-Spin';
  rating: number; // 60 - 99
  battingRating: number;
  bowlingRating: number;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string; // Tailwind color hex or class name
  secondaryColor: string;
  textColor: string;
  flagEmoji: string;
  players: Player[];
}

export type GamePhase = 'menu' | 'team_select' | 'toss' | 'gameplay' | 'innings_break' | 'summary' | 'career' | 'tournament' | 'multiplayer';

export type DeliveryType = 'Fast' | 'Medium' | 'OffSpin' | 'LegSpin';

export interface BallPhysics {
  x: number; // X-axis (width of pitch: -1.5m to 1.5m, 0 is center/middle stump)
  y: number; // Y-axis (length of pitch: 0m to 20.12m. 0 is Bowler, 20.12 is Batsman)
  z: number; // Z-axis (height: 0 is grass, >0 is in the air)
  vx: number;
  vy: number;
  vz: number;
  ax: number; // swing/drift acceleration in air
  ay: number; // friction deceleration
  az: number; // gravity
  spin: number; // spin multiplier (positive = right breakout, negative = left breakout)
  swing: number; // swing multiplier
  bounced: boolean;
  hit: boolean;
  isStumpHit: boolean;
  isOut: boolean;
  outReason?: 'Bowled' | 'Caught' | 'L.B.W' | 'Run Out' | 'Stumped';
  shotAngle?: number; // angle ball was hit (0 is straight back, -180 to 180)
  shotPower?: number; // velocity of the shot
  shotDistance?: number; // distance the shot travelled
  resultRuns?: number; // runs scored off this delivery
  pitchPoint?: { x: number; y: number }; // coordinate where ball pitched
}

export interface BallHistory {
  ballNumber: number; // e.g. 1 to 6 for the over
  bowlerName: string;
  batsmanName: string;
  runs: number;
  isWicket: boolean;
  wicketReason?: string;
  deliveryType: string;
  speedKph: number;
  shotAngle?: number;
  shotDistance?: number;
  pitchX: number;
  pitchY: number;
}

export interface Innings {
  runs: number;
  wickets: number;
  balls: number; // total balls bowled
  oversHistory: BallHistory[][]; // grouped by over
  currentOver: BallHistory[];
  batsman1: { player: Player; runs: number; balls: number; fours: number; sixes: number; isOut: boolean; outReason?: string };
  batsman2: { player: Player; runs: number; balls: number; fours: number; sixes: number; isOut: boolean; outReason?: string };
  currentBowler: { player: Player; overs: number; maidens: number; runs: number; wickets: number; balls: number };
  extras: { wides: number; noBalls: number; byes: number; legByes: number };
  target?: number; // target to chase (for 2nd innings)
}

export interface StadiumTheme {
  id: string;
  name: string;
  timeOfDay: 'Day' | 'Twilight' | 'Night';
  skyGradient: string[];
  ambientColor: string;
  lightIntensity: number;
}

// CAREER MODE TYPES
export interface CustomCricketer {
  name: string;
  role: 'Batsman' | 'Bowler' | 'AllRounder' | 'WicketKeeper';
  battingStyle: 'Right-Hand' | 'Left-Hand';
  bowlingStyle: 'Fast-Pace' | 'Medium-Pace' | 'Off-Spin' | 'Leg-Spin';
  jerseyName: string;
  kitNumber: string;
  skinTone: string; // '#F5CBA7' | '#D35400' | '#5D4037' etc.
  hairStyle: 'Short' | 'Spiky' | 'Long' | 'Bald';
  hairColor: string; // '#4A3B32' | '#1A1A1A' | '#F4D03F'
  batBrand: string; // 'Kookaburra' | 'MRF' | 'Gray-Nicolls' | 'Spartan'
  // Distributed Stats (Total max 100 per stat)
  stats: {
    battingPower: number;
    timing: number;
    bowlingPace: number;
    bowlingSpin: number;
    control: number;
    runningSpeed: number;
  };
}

export interface CareerProfile {
  customCricketer: CustomCricketer;
  currentLevel: 1 | 2 | 3 | 4; // 1: Academy, 2: Domestic, 3: International Cap, 4: Legend
  stamina: number; // 0 - 100
  trainingPoints: number;
  credits: number;
  fame: number; // popularity
  matchesPlayed: number;
  runsScored: number;
  wicketsTaken: number;
  highScore: number;
  notOuts: number;
  fifties: number;
  bestBowlingWickets: number;
  bestBowlingRuns: number;
  decisionsMade: string[]; // Track decision keys chosen
}

// TOURNAMENT MODE TYPES
export interface TournamentFixture {
  id: string;
  round: number;
  team1Id: string;
  team2Id: string;
  score1?: string; // e.g. "124/3 (5 ov)"
  score2?: string;
  winnerId?: string;
  isPlayed: boolean;
}

export interface TeamStanding {
  teamId: string;
  teamName: string;
  flagEmoji: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  netRunRate: number;
}

export interface Tournament {
  id: string;
  type: 'world_cup' | 'ashes' | 't20_league';
  name: string;
  userTeamId: string;
  teams: Team[];
  fixtures: TournamentFixture[];
  standings: TeamStanding[];
  currentRound: number;
  isCompleted: boolean;
  wonTrophy: boolean;
}

// MULTIPLAYER MODE TYPES
export interface MultiplayerState {
  roomCode: string | null;
  role: 'host' | 'guest' | null;
  gameMode: 'competitive' | 'cooperative';
  opponentName: string | null;
  opponentTeamId: string | null;
  hostReady: boolean;
  guestReady: boolean;
  status: 'lobby' | 'playing' | 'disconnected' | 'idle';
  isConnected: boolean;
  chatMessages: { sender: string; message: string; timestamp: Date }[];
}

