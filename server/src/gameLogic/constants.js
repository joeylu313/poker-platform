// Game constants and configuration
const GAME_CONSTANTS = {
  // Hand rankings (higher number = better hand)
  HAND_RANKINGS: {
    HIGH_CARD: 1,
    PAIR: 2,
    TWO_PAIR: 3,
    THREE_OF_A_KIND: 4,
    STRAIGHT: 5,
    FLUSH: 6,
    FULL_HOUSE: 7,
    FOUR_OF_A_KIND: 8,
    STRAIGHT_FLUSH: 9,
    ROYAL_FLUSH: 10
  },

  // Hand names for display
  HAND_NAMES: {
    1: 'High Card',
    2: 'One Pair',
    3: 'Two Pair',
    4: 'Three of a Kind',
    5: 'Straight',
    6: 'Flush',
    7: 'Full House',
    8: 'Four of a Kind',
    9: 'Straight Flush',
    10: 'Royal Flush'
  },

  // Card ranks and values
  RANKS: ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'],
  SUITS: ['hearts', 'diamonds', 'clubs', 'spades'],
  
  // Game phases
  PHASES: {
    WAITING: 'waiting',
    PREFLOP: 'preflop',
    FLOP: 'flop',
    TURN: 'turn',
    RIVER: 'river',
    SHOWDOWN: 'showdown'
  },

  // Default game settings
  DEFAULT_STACK_SIZE: 1000,
  DEFAULT_BLINDS: { small: 10, big: 20 },
  MAX_PLAYERS: 8,
  MIN_PLAYERS: 2,

  // Betting constants
  MIN_RAISE_MULTIPLIER: 1,
  ALL_IN_THRESHOLD: 0.1, // 10% of stack considered "all-in"

  // Performance settings
  CACHE_SIZE: 1000,
  EVALUATION_CACHE_SIZE: 5000
};

module.exports = GAME_CONSTANTS; 