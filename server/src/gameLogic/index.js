// Export the main optimized PokerGame class
const { PokerGame } = require('./PokerGame.js');

// Export individual modules for advanced usage
const { Deck } = require('./deck.js');
const { HandEvaluator } = require('./handEvaluator.js');
const { BettingManager } = require('./betting.js');
const { PlayerManager } = require('./playerManager.js');
const { GameStateManager } = require('./gameState.js');

// Export constants
const constants = require('./constants.js');

module.exports = {
  PokerGame,
  Deck,
  HandEvaluator,
  BettingManager,
  PlayerManager,
  GameStateManager,
  ...constants
}; 