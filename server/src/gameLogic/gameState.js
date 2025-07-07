const { PHASES } = require('./constants.js');

/**
 * Optimized game state management for Texas Hold'em
 * Features:
 * - Game phase tracking
 * - Community card management
 * - Efficient state transitions
 * - Memory-optimized state objects
 */
class GameStateManager {
  constructor() {
    this.gamePhase = PHASES.WAITING;
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.currentPlayer = 0;
    this.dealer = 0;
    this.lastAction = null;
    this.bustedPlayers = [];
  }

  /**
   * Initialize game state for a new hand
   */
  initializeGame(players, blinds) {
    this.gamePhase = PHASES.PREFLOP;
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.currentPlayer = 0;
    this.lastAction = null;
    this.bustedPlayers = [];

    // Post blinds
    this._postBlinds(players, blinds);

    return this.getState();
  }

  /**
   * Post blinds for the current hand
   */
  _postBlinds(players, blinds) {
    const activePlayers = players.filter(p => p.isActive);
    if (activePlayers.length < 2) return;

    const sbPos = (this.dealer + 1) % activePlayers.length;
    const bbPos = (this.dealer + 2) % activePlayers.length;

    // Small blind
    const sbPlayer = activePlayers[sbPos];
    const sbAmount = Math.min(blinds.small, sbPlayer.stack);
    sbPlayer.bet = sbAmount;
    sbPlayer.stack -= sbAmount;
    this.pot += sbAmount;

    // Big blind
    const bbPlayer = activePlayers[bbPos];
    const bbAmount = Math.min(blinds.big, bbPlayer.stack);
    bbPlayer.bet = bbAmount;
    bbPlayer.stack -= bbAmount;
    this.pot += bbAmount;

    this.currentBet = bbAmount;
    this.currentPlayer = (this.dealer + 3) % activePlayers.length; // UTG position
  }

  /**
   * Deal community cards for the current phase
   */
  dealCommunityCards() {
    switch (this.gamePhase) {
      case PHASES.PREFLOP:
        this.gamePhase = PHASES.FLOP;
        // Flop: 3 cards
        break;
      case PHASES.FLOP:
        this.gamePhase = PHASES.TURN;
        // Turn: 1 card
        break;
      case PHASES.TURN:
        this.gamePhase = PHASES.RIVER;
        // River: 1 card
        break;
      case PHASES.RIVER:
        this.gamePhase = PHASES.SHOWDOWN;
        break;
      default:
        throw new Error(`Cannot deal cards in phase: ${this.gamePhase}`);
    }

    return this.getState();
  }

  /**
   * Add community cards
   */
  addCommunityCards(cards) {
    this.communityCards.push(...cards);
  }

  /**
   * Get current community cards
   */
  getCommunityCards() {
    return [...this.communityCards];
  }

  /**
   * Update current player
   */
  setCurrentPlayer(playerIndex) {
    this.currentPlayer = playerIndex;
  }

  /**
   * Get current player index
   */
  getCurrentPlayer() {
    return this.currentPlayer;
  }

  /**
   * Move to next player
   */
  moveToNextPlayer(players) {
    const activePlayers = players.filter(p => !p.folded && p.isActive);
    if (activePlayers.length === 0) return;

    let nextIndex = (this.currentPlayer + 1) % players.length;
    
    // Find next active player
    while (nextIndex !== this.currentPlayer) {
      const player = players[nextIndex];
      if (!player.folded && player.isActive && !player.allIn) {
        this.currentPlayer = nextIndex;
        return;
      }
      nextIndex = (nextIndex + 1) % players.length;
    }
  }

  /**
   * Update pot amount
   */
  updatePot(amount) {
    this.pot = amount;
  }

  /**
   * Get current pot
   */
  getPot() {
    return this.pot;
  }

  /**
   * Update current bet
   */
  updateCurrentBet(amount) {
    this.currentBet = amount;
  }

  /**
   * Get current bet
   */
  getCurrentBet() {
    return this.currentBet;
  }

  /**
   * Set dealer position
   */
  setDealer(dealerIndex) {
    this.dealer = dealerIndex;
  }

  /**
   * Get dealer position
   */
  getDealer() {
    return this.dealer;
  }

  /**
   * Rotate dealer to next active player
   */
  rotateDealer(players) {
    const activePlayers = players.filter(p => p.isActive);
    if (activePlayers.length === 0) return;

    const currentDealerIndex = activePlayers.findIndex(p => p.id === players[this.dealer]?.id);
    const nextDealerIndex = (currentDealerIndex + 1) % activePlayers.length;
    this.dealer = players.findIndex(p => p.id === activePlayers[nextDealerIndex].id);
  }

  /**
   * Record last action
   */
  setLastAction(action) {
    this.lastAction = action;
  }

  /**
   * Get last action
   */
  getLastAction() {
    return this.lastAction;
  }

  /**
   * Check if betting round is complete
   */
  isBettingRoundComplete(players) {
    const activePlayers = players.filter(p => !p.folded && p.isActive);
    
    if (activePlayers.length <= 1) return true;

    // Check if all active players have acted and bets are equal
    const maxBet = Math.max(...activePlayers.map(p => p.bet));
    const allBetsEqual = activePlayers.every(p => p.bet === maxBet || p.allIn);
    
    // Check if all players have acted
    const allActed = activePlayers.every(p => p.hasActed || p.allIn);
    
    return allBetsEqual && allActed;
  }

  /**
   * Check if all players are all-in
   */
  areAllPlayersAllIn(players) {
    const activePlayers = players.filter(p => !p.folded && p.isActive);
    return activePlayers.length > 0 && activePlayers.every(p => p.allIn);
  }

  /**
   * Check if this is an all-in showdown
   */
  isAllInShowdown(players) {
    const activePlayers = players.filter(p => !p.folded && p.isActive);
    return activePlayers.length > 1 && activePlayers.every(p => p.allIn);
  }

  /**
   * Add busted player
   */
  addBustedPlayer(player) {
    this.bustedPlayers.push(player);
  }

  /**
   * Get busted players
   */
  getBustedPlayers() {
    return this.bustedPlayers;
  }

  /**
   * Check if game should end
   */
  shouldEndGame(players) {
    const activePlayers = players.filter(p => !p.folded && p.isActive);
    return activePlayers.length < 2;
  }

  /**
   * Get current game state
   */
  getState() {
    return {
      gamePhase: this.gamePhase,
      communityCards: [...this.communityCards],
      pot: this.pot,
      currentBet: this.currentBet,
      currentPlayer: this.currentPlayer,
      dealer: this.dealer,
      lastAction: this.lastAction,
      bustedPlayers: [...this.bustedPlayers]
    };
  }

  /**
   * Reset game state
   */
  reset() {
    this.gamePhase = PHASES.WAITING;
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.currentPlayer = 0;
    this.dealer = 0;
    this.lastAction = null;
    this.bustedPlayers = [];
  }

  /**
   * Get game statistics
   */
  getStats() {
    return {
      phase: this.gamePhase,
      communityCards: this.communityCards.length,
      pot: this.pot,
      currentBet: this.currentBet,
      bustedPlayers: this.bustedPlayers.length
    };
  }
}

module.exports = { GameStateManager }; 