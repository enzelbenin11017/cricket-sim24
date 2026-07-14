import { Team, Player } from '../types';

function createPlayer(id: string, name: string, role: Player['role'], battingStyle: Player['battingStyle'], bowlingStyle: Player['bowlingStyle'], rating: number): Player {
  // Distribute specific sub-ratings
  let battingRating = rating;
  let bowlingRating = 50;

  if (role === 'Bowler') {
    battingRating = Math.max(30, rating - 35);
    bowlingRating = rating;
  } else if (role === 'AllRounder') {
    battingRating = Math.max(70, rating - 5);
    bowlingRating = Math.max(70, rating - 5);
  } else if (role === 'WicketKeeper') {
    battingRating = Math.max(75, rating);
    bowlingRating = 30;
  }

  return {
    id,
    name,
    role,
    battingStyle,
    bowlingStyle,
    rating,
    battingRating,
    bowlingRating
  };
}

export const TEAMS: Team[] = [
  {
    id: 'ind',
    name: 'India',
    shortName: 'IND',
    primaryColor: '#00529B', // Royal Blue
    secondaryColor: '#FF6600', // Saffron
    textColor: '#FFFFFF',
    flagEmoji: '🇮🇳',
    players: [
      createPlayer('ind_1', 'R. Sharma', 'Batsman', 'Right-Hand', 'Off-Spin', 92),
      createPlayer('ind_2', 'Y. Jaiswal', 'Batsman', 'Left-Hand', 'Off-Spin', 88),
      createPlayer('ind_3', 'V. Kohli', 'Batsman', 'Right-Hand', 'Medium-Pace', 94),
      createPlayer('ind_4', 'S. Yadav', 'Batsman', 'Right-Hand', 'Off-Spin', 90),
      createPlayer('ind_5', 'R. Pant', 'WicketKeeper', 'Left-Hand', 'Medium-Pace', 89),
      createPlayer('ind_6', 'H. Pandya', 'AllRounder', 'Right-Hand', 'Fast-Pace', 88),
      createPlayer('ind_7', 'R. Jadeja', 'AllRounder', 'Left-Hand', 'Off-Spin', 90),
      createPlayer('ind_8', 'A. Patel', 'AllRounder', 'Left-Hand', 'Off-Spin', 85),
      createPlayer('ind_9', 'K. Yadav', 'Bowler', 'Right-Hand', 'Leg-Spin', 88),
      createPlayer('ind_10', 'J. Bumrah', 'Bowler', 'Right-Hand', 'Fast-Pace', 96),
      createPlayer('ind_11', 'M. Siraj', 'Bowler', 'Right-Hand', 'Fast-Pace', 86),
    ]
  },
  {
    id: 'aus',
    name: 'Australia',
    shortName: 'AUS',
    primaryColor: '#FFCD00', // Australian Gold
    secondaryColor: '#004B87', // Dark Greenish-Blue
    textColor: '#000000',
    flagEmoji: '🇦🇺',
    players: [
      createPlayer('aus_1', 'T. Head', 'Batsman', 'Left-Hand', 'Off-Spin', 90),
      createPlayer('aus_2', 'D. Warner', 'Batsman', 'Left-Hand', 'Leg-Spin', 87),
      createPlayer('aus_3', 'M. Marsh', 'AllRounder', 'Right-Hand', 'Medium-Pace', 86),
      createPlayer('aus_4', 'S. Smith', 'Batsman', 'Right-Hand', 'Leg-Spin', 93),
      createPlayer('aus_5', 'G. Maxwell', 'AllRounder', 'Right-Hand', 'Off-Spin', 89),
      createPlayer('aus_6', 'M. Stoinis', 'AllRounder', 'Right-Hand', 'Fast-Pace', 84),
      createPlayer('aus_7', 'M. Wade', 'WicketKeeper', 'Left-Hand', 'Medium-Pace', 81),
      createPlayer('aus_8', 'P. Cummins', 'Bowler', 'Right-Hand', 'Fast-Pace', 92),
      createPlayer('aus_9', 'M. Starc', 'Bowler', 'Left-Hand', 'Fast-Pace', 91),
      createPlayer('aus_10', 'A. Zampa', 'Bowler', 'Right-Hand', 'Leg-Spin', 89),
      createPlayer('aus_11', 'J. Hazlewood', 'Bowler', 'Right-Hand', 'Fast-Pace', 88),
    ]
  },
  {
    id: 'eng',
    name: 'England',
    shortName: 'ENG',
    primaryColor: '#002F6C', // Navy Blue
    secondaryColor: '#E40046', // England Red
    textColor: '#FFFFFF',
    flagEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    players: [
      createPlayer('eng_1', 'P. Salt', 'Batsman', 'Right-Hand', 'Off-Spin', 86),
      createPlayer('eng_2', 'J. Buttler', 'WicketKeeper', 'Right-Hand', 'Medium-Pace', 91),
      createPlayer('eng_3', 'W. Jacks', 'Batsman', 'Right-Hand', 'Off-Spin', 83),
      createPlayer('eng_4', 'J. Bairstow', 'Batsman', 'Right-Hand', 'Medium-Pace', 85),
      createPlayer('eng_5', 'H. Brook', 'Batsman', 'Right-Hand', 'Medium-Pace', 87),
      createPlayer('eng_6', 'L. Livingstone', 'AllRounder', 'Right-Hand', 'Leg-Spin', 85),
      createPlayer('eng_7', 'M. Ali', 'AllRounder', 'Left-Hand', 'Off-Spin', 84),
      createPlayer('eng_8', 'S. Curran', 'AllRounder', 'Left-Hand', 'Fast-Pace', 86),
      createPlayer('eng_9', 'A. Rashid', 'Bowler', 'Right-Hand', 'Leg-Spin', 88),
      createPlayer('eng_10', 'J. Archer', 'Bowler', 'Right-Hand', 'Fast-Pace', 89),
      createPlayer('eng_11', 'R. Topley', 'Bowler', 'Left-Hand', 'Fast-Pace', 82),
    ]
  },
  {
    id: 'pak',
    name: 'Pakistan',
    shortName: 'PAK',
    primaryColor: '#115740', // Pakistan Green
    secondaryColor: '#FFFFFF',
    textColor: '#FFFFFF',
    flagEmoji: '🇵🇰',
    players: [
      createPlayer('pak_1', 'M. Rizwan', 'WicketKeeper', 'Right-Hand', 'Medium-Pace', 88),
      createPlayer('pak_2', 'B. Azam', 'Batsman', 'Right-Hand', 'Off-Spin', 92),
      createPlayer('pak_3', 'F. Zaman', 'Batsman', 'Left-Hand', 'Off-Spin', 85),
      createPlayer('pak_4', 'U. Khan', 'Batsman', 'Right-Hand', 'Off-Spin', 78),
      createPlayer('pak_5', 'I. Ahmed', 'AllRounder', 'Right-Hand', 'Off-Spin', 82),
      createPlayer('pak_6', 'S. Khan', 'AllRounder', 'Right-Hand', 'Leg-Spin', 84),
      createPlayer('pak_7', 'I. Wasim', 'AllRounder', 'Left-Hand', 'Off-Spin', 85),
      createPlayer('pak_8', 'S. Afridi', 'Bowler', 'Left-Hand', 'Fast-Pace', 91),
      createPlayer('pak_9', 'N. Shah', 'Bowler', 'Right-Hand', 'Fast-Pace', 88),
      createPlayer('pak_10', 'H. Rauf', 'Bowler', 'Right-Hand', 'Fast-Pace', 86),
      createPlayer('pak_11', 'A. Jamal', 'Bowler', 'Right-Hand', 'Fast-Pace', 80),
    ]
  },
  {
    id: 'rsa',
    name: 'South Africa',
    shortName: 'RSA',
    primaryColor: '#007A4D', // Forest Green
    secondaryColor: '#FFB612', // Gold
    textColor: '#FFFFFF',
    flagEmoji: '🇿🇦',
    players: [
      createPlayer('rsa_1', 'R. Hendricks', 'Batsman', 'Right-Hand', 'Off-Spin', 82),
      createPlayer('rsa_2', 'Q. de Kock', 'WicketKeeper', 'Left-Hand', 'Off-Spin', 89),
      createPlayer('rsa_3', 'A. Markram', 'AllRounder', 'Right-Hand', 'Off-Spin', 87),
      createPlayer('rsa_4', 'H. Klaasen', 'Batsman', 'Right-Hand', 'Off-Spin', 91),
      createPlayer('rsa_5', 'D. Miller', 'Batsman', 'Left-Hand', 'Off-Spin', 88),
      createPlayer('rsa_6', 'T. Stubbs', 'Batsman', 'Right-Hand', 'Off-Spin', 84),
      createPlayer('rsa_7', 'M. Jansen', 'AllRounder', 'Left-Hand', 'Fast-Pace', 86),
      createPlayer('rsa_8', 'K. Maharaj', 'Bowler', 'Right-Hand', 'Off-Spin', 87),
      createPlayer('rsa_9', 'K. Rabada', 'Bowler', 'Right-Hand', 'Fast-Pace', 90),
      createPlayer('rsa_10', 'A. Nortje', 'Bowler', 'Right-Hand', 'Fast-Pace', 86),
      createPlayer('rsa_11', 'O. Baartman', 'Bowler', 'Right-Hand', 'Medium-Pace', 81),
    ]
  },
  {
    id: 'nzl',
    name: 'New Zealand',
    shortName: 'NZ',
    primaryColor: '#000000', // Blackcaps Black
    secondaryColor: '#8C8C8C', // Silver
    textColor: '#FFFFFF',
    flagEmoji: '🇳🇿',
    players: [
      createPlayer('nz_1', 'D. Conway', 'WicketKeeper', 'Left-Hand', 'Off-Spin', 87),
      createPlayer('nz_2', 'F. Allen', 'Batsman', 'Right-Hand', 'Off-Spin', 83),
      createPlayer('nz_3', 'K. Williamson', 'Batsman', 'Right-Hand', 'Off-Spin', 92),
      createPlayer('nz_4', 'D. Mitchell', 'AllRounder', 'Right-Hand', 'Medium-Pace', 88),
      createPlayer('nz_5', 'G. Phillips', 'AllRounder', 'Right-Hand', 'Off-Spin', 86),
      createPlayer('nz_6', 'M. Chapman', 'Batsman', 'Left-Hand', 'Off-Spin', 80),
      createPlayer('nz_7', 'M. Santner', 'AllRounder', 'Left-Hand', 'Off-Spin', 86),
      createPlayer('nz_8', 'K. Jamieson', 'Bowler', 'Right-Hand', 'Fast-Pace', 84),
      createPlayer('nz_9', 'M. Henry', 'Bowler', 'Right-Hand', 'Fast-Pace', 87),
      createPlayer('nz_10', 'T. Southee', 'Bowler', 'Right-Hand', 'Fast-Pace', 86),
      createPlayer('nz_11', 'T. Boult', 'Bowler', 'Left-Hand', 'Fast-Pace', 89),
    ]
  }
];

export const MATCH_OVERS_OPTIONS = [
  { value: 1, label: '1 Over (Super Over)' },
  { value: 2, label: '2 Overs (Blitz)' },
  { value: 5, label: '5 Overs (Quick Match)' },
];

export const DIFFICULTY_OPTIONS = [
  { value: 'easy', label: 'Rookie (Easy)' },
  { value: 'medium', label: 'Pro (Medium)' },
  { value: 'hard', label: 'Legend (Hard)' }
];
