const { DEFAULT_STACK_SIZE } = require('./constants.js');

/**
 * Optimized player management for Texas Hold'em
 * Features:
 * - Player state tracking
 * - All-in detection
 * - Bust-out handling
 * - Memory-efficient player objects
 */
class PlayerManager {
  constructor() {
    this.players = [];
    this.activePlayers = [];
    this.bustedPlayers = [];
  }

  /**
   * Add a player to the game
   */
  addPlayer(playerData) {
    const player = {
      id: playerData.id,
      name: playerData.name,
      stack: playerData.stack || DEFAULT_STACK_SIZE,
      bet: 0,
      folded: false,
      allIn: false,
      isActive: true,
      hasActed: false,
      cards: [],
      isHost: playerData.isHost || false,
      ...playerData
    };

    this.players.push(player);
    this.activePlayers.push(player);
    
    return player;
  }

  /**
   * Remove a player from the game
   */
  removePlayer(playerId) {
    const index = this.players.findIndex(p => p.id === playerId);
    if (index !== -1) {
      const player = this.players.splice(index, 1)[0];
      this.activePlayers = this.activePlayers.filter(p => p.id !== playerId);
      return player;
    }
    return null;
  }

  /**
   * Get player by ID
   */
  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  /**
   * Get active players (not folded, not busted)
   */
  getActivePlayers() {
    return this.players.filter(p => !p.folded && p.isActive);
  }

  /**
   * Get players who can still act
   */
  getActingPlayers() {
    return this.players.filter(p => !p.folded && p.isActive && !p.allIn);
  }

  /**
   * Check if player is all-in
   */
  isPlayerAllIn(playerId) {
    const player = this.getPlayer(playerId);
    return player && player.allIn;
  }

  /**
   * Check if player is busted
   */
  isPlayerBusted(playerId) {
    const player = this.getPlayer(playerId);
    return player && !player.isActive;
  }

  /**
   * Process player action
   */
  processPlayerAction(playerId, action, amount = 0) {
    const player = this.getPlayer(playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    // Update action flag
    player.hasActed = true;

    // Process action
    switch (action) {
      case 'fold':
        player.folded = true;
        break;

      case 'check':
        // No stack changes for check
        break;

      case 'call':
        const callAmount = Math.min(amount, player.stack);
        player.stack -= callAmount;
        player.bet += callAmount;
        
        if (player.stack === 0) {
          player.allIn = true;
        }
        break;

      case 'raise':
        const raiseAmount = Math.min(amount, player.stack);
        player.stack -= raiseAmount;
        player.bet += raiseAmount;
        
        if (player.stack === 0) {
          player.allIn = true;
        }
        break;

      case 'allIn':
        const allInAmount = player.stack;
        player.stack = 0;
        player.bet += allInAmount;
        player.allIn = true;
        break;

      default:
        throw new Error(`Invalid action: ${action}`);
    }

    return player;
  }

  /**
   * Deal cards to players
   */
  dealCardsToPlayers(cards) {
    if (cards.length < this.activePlayers.length * 2) {
      throw new Error('Not enough cards for all players');
    }

    this.activePlayers.forEach((player, index) => {
      player.cards = cards.slice(index * 2, (index + 1) * 2);
    });
  }

  /**
   * Reset player states for new hand
   */
  resetForNewHand() {
    this.players.forEach(player => {
      player.bet = 0;
      player.folded = false;
      player.allIn = false;
      player.hasActed = false;
      player.cards = [];
    });
  }

  /**
   * Check for busted players
   */
  checkForBustedPlayers() {
    const busted = this.players.filter(p => p.stack <= 0 && p.isActive);
    
    busted.forEach(player => {
      player.isActive = false;
      this.bustedPlayers.push(player);
    });

    return busted;
  }

  /**
   * Get busted players
   */
  getBustedPlayers() {
    return this.bustedPlayers;
  }

  /**
   * Check if game should end due to insufficient players
   */
  hasInsufficientPlayers() {
    const activePlayers = this.getActivePlayers();
    return activePlayers.length < 2;
  }

  /**
   * Get winner when only one player remains
   */
  getLastPlayerStanding() {
    const activePlayers = this.getActivePlayers();
    return activePlayers.length === 1 ? activePlayers[0] : null;
  }

  /**
   * Rotate dealer position
   */
  rotateDealer() {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length > 0) {
      // Move dealer chip to next active player
      const currentDealer = activePlayers.find(p => p.isDealer);
      if (currentDealer) {
        currentDealer.isDealer = false;
      }
      
      const nextDealerIndex = (activePlayers.indexOf(currentDealer) + 1) % activePlayers.length;
      activePlayers[nextDealerIndex].isDealer = true;
    }
  }

  /**
   * Get player view (for sending to client)
   */
  getPlayerView(playerId, includeCards = false) {
    const player = this.getPlayer(playerId);
    if (!player) return null;

    const view = {
      id: player.id,
      name: player.name,
      stack: player.stack,
      bet: player.bet,
      folded: player.folded,
      allIn: player.allIn,
      isActive: player.isActive,
      isHost: player.isHost,
      isDealer: player.isDealer
    };

    if (includeCards) {
      view.cards = player.cards;
    }

    return view;
  }

  /**
   * Get all player views
   */
  getAllPlayerViews(includeCards = false) {
    return this.players.map(player => this.getPlayerView(player.id, includeCards));
  }

  /**
   * Get game statistics
   */
  getStats() {
    return {
      totalPlayers: this.players.length,
      activePlayers: this.getActivePlayers().length,
      bustedPlayers: this.bustedPlayers.length,
      allInPlayers: this.players.filter(p => p.allIn).length
    };
  }

  /**
   * Clear all players
   */
  clear() {
    this.players = [];
    this.activePlayers = [];
    this.bustedPlayers = [];
  }
}

module.exports = { PlayerManager }; 