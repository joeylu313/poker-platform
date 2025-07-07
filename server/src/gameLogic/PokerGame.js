const { Deck } = require('./deck.js');
const { HandEvaluator } = require('./handEvaluator.js');
const { BettingManager } = require('./betting.js');
const { PlayerManager } = require('./playerManager.js');
const { GameStateManager } = require('./gameState.js');
const { DEFAULT_BLINDS } = require('./constants.js');

/**
 * Optimized PokerGame class for Texas Hold'em
 * Features:
 * - Modular architecture with specialized managers
 * - Cached hand evaluations for performance
 * - Memory-efficient data structures
 * - Comprehensive game state management
 * - Side pot calculation for all-in situations
 */
class PokerGame {
  constructor() {
    this.deck = new Deck();
    this.handEvaluator = new HandEvaluator();
    this.bettingManager = new BettingManager();
    this.playerManager = new PlayerManager();
    this.gameStateManager = new GameStateManager();
    
    this.players = [];
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.currentPlayer = 0;
    this.gamePhase = 'waiting';
    this.dealer = 0;
    this.lastAction = null;
    this.bustedPlayers = [];
    
    // Game configuration
    this.smallBlind = DEFAULT_BLINDS.SMALL;
    this.bigBlind = DEFAULT_BLINDS.BIG;
  }

  /**
   * Initialize game with players and blinds
   */
  initializeGame(players, blinds) {
    this.players = players.map(player => ({
      ...player,
      bet: 0,
      folded: false,
      allIn: false,
      hasActed: false,
      cards: []
    }));

    // Initialize managers
    this.bettingManager.initializeBetting(blinds);
    
    // Set initial state
    this.gamePhase = 'preflop';
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.currentPlayer = 0;
    this.dealer = 0;
    this.lastAction = null;
    this.bustedPlayers = [];

    // Post blinds
    this._postBlinds(blinds);

    return this.getState();
  }

  /**
   * Post blinds for the current hand
   */
  _postBlinds(blinds) {
    console.log('BLINDS OBJECT:', JSON.stringify(blinds));
    // Reset all player bets to 0 before posting blinds
    this.players.forEach(p => { p.bet = 0; });
    const activePlayers = this.players.filter(p => p.isActive);
    if (activePlayers.length < 2) return;

    let dealerPos = this.dealer;
    let sbPos, bbPos;
    
    if (activePlayers.length === 2) {
      // Heads-up: dealer is always the button, non-dealer is always the big blind
      // In heads-up, the dealer is the button, and the non-dealer is the big blind
      // The dealer is the button, the non-dealer is the big blind
      bbPos = dealerPos; // Dealer is the button and big blind in heads-up
      sbPos = (dealerPos + 1) % activePlayers.length;
    } else {
      // 3+ players: SB is left of dealer, BB is left of SB
      sbPos = (dealerPos + 1) % activePlayers.length;
      bbPos = (dealerPos + 2) % activePlayers.length;
    }

    // Small blind
    const sbPlayer = activePlayers[sbPos];
    const sbAmount = Math.min(blinds.small, sbPlayer.stack);
    sbPlayer.stack -= sbAmount;
    sbPlayer.bet += sbAmount;

    // Big blind
    const bbPlayer = activePlayers[bbPos];
    const bbAmount = Math.min(blinds.big, bbPlayer.stack);
    bbPlayer.stack -= bbAmount;
    bbPlayer.bet += bbAmount;

    // Set current bet to big blind
    this.currentBet = bbPlayer.bet;
    this.pot = sbAmount + bbAmount;

    // Debug logs
    console.log('--- BLIND ASSIGNMENT DEBUG ---');
    console.log(`Dealer index: ${dealerPos} (${activePlayers[dealerPos].name})`);
    console.log(`Small Blind index: ${sbPos} (${sbPlayer.name}), Stack: ${sbPlayer.stack}, Bet: ${sbPlayer.bet}`);
    console.log(`Big Blind index: ${bbPos} (${bbPlayer.name}), Stack: ${bbPlayer.stack}, Bet: ${bbPlayer.bet}`);
    console.log('------------------------------');

    // Set betting order correctly for preflop
    if (activePlayers.length === 2) {
      // Heads-up: big blind (dealer) acts first preflop
      this.currentPlayer = bbPos;
    } else {
      // 3+ players: first active left of BB acts first
      let firstToAct = (bbPos + 1) % activePlayers.length;
      let count = 0;
      while (!activePlayers[firstToAct].isActive && count < activePlayers.length) {
        firstToAct = (firstToAct + 1) % activePlayers.length;
        count++;
      }
      this.currentPlayer = firstToAct;
    }
    console.log(`First to act: ${this.currentPlayer} (${activePlayers[this.currentPlayer].name})`);
  }

  /**
   * Deal hole cards to all active players
   */
  dealHoleCards() {
    this.deck.reset();
    this.deck.shuffle();

    const activePlayers = this.players.filter(p => p.isActive);
    
    // Deal 2 cards to each active player
    for (let i = 0; i < 2; i++) {
      for (const player of activePlayers) {
        const card = this.deck.dealCard();
        if (card) {
          player.cards.push(card);
        }
      }
    }
  }

  /**
   * Deal community cards for the current phase
   */
  dealCommunityCards() {
    this.deck.shuffle(); // Re-shuffle for community cards

    // Reset hasActed flags for all players when moving to next phase
    this.players.forEach(p => { p.hasActed = false; });

    // Reset current bet when moving to next phase
    this.currentBet = 0;
    
    // Reset all player bets when moving to next phase
    this.players.forEach(p => { p.bet = 0; });

    switch (this.gamePhase) {
      case 'preflop':
        // Burn one card, then deal flop (3 cards)
        this.deck.dealCard(); // Burn
        const flopCards = this.deck.dealCards(3);
        this.communityCards.push(...flopCards);
        this.gamePhase = 'flop';
        // Set first to act for flop (left of dealer)
        const activePlayers = this.players.filter(p => p.isActive);
        if (activePlayers.length >= 2) {
          let firstToAct = (this.dealer + 1) % this.players.length;
          // Find the first active player left of dealer
          let count = 0;
          while ((this.players[firstToAct].folded || !this.players[firstToAct].isActive) && count < this.players.length) {
            firstToAct = (firstToAct + 1) % this.players.length;
            count++;
          }
          this.currentPlayer = firstToAct;
        }
        break;

      case 'flop':
        // Burn one card, then deal turn (1 card)
        this.deck.dealCard(); // Burn
        const turnCard = this.deck.dealCard();
        if (turnCard) {
          this.communityCards.push(turnCard);
        }
        this.gamePhase = 'turn';
        // Set first to act for turn (left of dealer)
        const activePlayersTurn = this.players.filter(p => p.isActive);
        if (activePlayersTurn.length >= 2) {
          let firstToAct = (this.dealer + 1) % this.players.length;
          // Find the first active player left of dealer
          let count = 0;
          while ((this.players[firstToAct].folded || !this.players[firstToAct].isActive) && count < this.players.length) {
            firstToAct = (firstToAct + 1) % this.players.length;
            count++;
          }
          this.currentPlayer = firstToAct;
        }
        break;

      case 'turn':
        // Burn one card, then deal river (1 card)
        this.deck.dealCard(); // Burn
        const riverCard = this.deck.dealCard();
        if (riverCard) {
          this.communityCards.push(riverCard);
        }
        this.gamePhase = 'river';
        // Set first to act for river (left of dealer)
        const activePlayersRiver = this.players.filter(p => p.isActive);
        if (activePlayersRiver.length >= 2) {
          let firstToAct = (this.dealer + 1) % this.players.length;
          // Find the first active player left of dealer
          let count = 0;
          while ((this.players[firstToAct].folded || !this.players[firstToAct].isActive) && count < this.players.length) {
            firstToAct = (firstToAct + 1) % this.players.length;
            count++;
          }
          this.currentPlayer = firstToAct;
        }
        break;

      case 'river':
        this.gamePhase = 'showdown';
        break;

      default:
        throw new Error(`Cannot deal cards in phase: ${this.gamePhase}`);
    }

    return this.getState();
  }

  /**
   * Process player action
   */
  processPlayerAction(playerId, action, amount = 0) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    // Prevent all-in players from acting (including folding)
    if (player.allIn) {
      throw new Error('All-in players cannot act');
    }
    if (player.folded) {
      throw new Error('Folded players cannot act');
    }
    if (player.stack <= 0) {
      throw new Error('You have no chips left to bet');
    }

    // Process action through betting manager
    const result = this.bettingManager.processAction(player, action, amount, this.players);
    
    // Update game state
    this.currentBet = this.bettingManager.currentBet;
    this.pot = this.bettingManager.pot;
    this.lastAction = { playerId, action, amount };

    // Mark player as acted
    player.hasActed = true;

    // Move to next player
    this.moveToNextPlayer();

    return result;
  }

  /**
   * Move to next player
   */
  moveToNextPlayer() {
    const activePlayers = this.players.filter(p => !p.folded && p.isActive);
    if (activePlayers.length === 0) return;

    let nextIndex = (this.currentPlayer + 1) % this.players.length;
    
    // Find next active player
    while (nextIndex !== this.currentPlayer) {
      const player = this.players[nextIndex];
      if (!player.folded && player.isActive && !player.allIn) {
        this.currentPlayer = nextIndex;
        return;
      }
      nextIndex = (nextIndex + 1) % this.players.length;
    }
    
    // If we can't find a next player, stay on current player
    // This can happen if all remaining players are all-in
    console.log('No next player found, staying on current player:', this.currentPlayer);
  }

  /**
   * Check if betting round is complete
   */
  isBettingRoundComplete() {
    const activePlayers = this.players.filter(p => !p.folded && p.isActive);
    
    if (activePlayers.length <= 1) return true;

    console.log('isBettingRoundComplete called:', { 
      activePlayers: activePlayers.length, 
      gamePhase: this.gamePhase, 
      currentBet: this.currentBet,
      playerStates: activePlayers.map(p => ({ name: p.name, bet: p.bet, hasActed: p.hasActed }))
    });

    // Special case: heads-up preflop, only two actions allowed
    if (activePlayers.length === 2 && this.gamePhase === 'preflop') {
      // Both players must have acted at least once
      const bothActed = activePlayers.every(p => p.hasActed);
      // In heads-up preflop, if both have acted and there's no current bet to call, betting is complete
      if (bothActed && this.currentBet === 0) {
        console.log('Heads-up preflop: both acted and no current bet, betting complete');
        return true;
      }
      // Their bets must be equal or one/all-in
      const maxBet = Math.max(...activePlayers.map(p => p.bet));
      const allBetsEqual = activePlayers.every(p => p.bet === maxBet || p.allIn);
      console.log('Heads-up preflop check:', { bothActed, allBetsEqual, currentBet: this.currentBet, playerBets: activePlayers.map(p => ({ name: p.name, bet: p.bet, hasActed: p.hasActed })) });
      return bothActed && allBetsEqual;
    }

    // Check if all active players have acted and bets are equal
    const maxBet = Math.max(...activePlayers.map(p => p.bet));
    const allBetsEqual = activePlayers.every(p => p.bet === maxBet || p.allIn);
    
    // Check if all players have acted
    // Note: All-in players are considered to have acted, but other players still need to respond
    const allActed = activePlayers.every(p => p.hasActed || p.allIn);
    
    // Special case: If there's an all-in player, other players must have a chance to respond
    const allInPlayers = activePlayers.filter(p => p.allIn);
    if (allInPlayers.length > 0) {
      const nonAllInPlayers = activePlayers.filter(p => !p.allIn);
      // If there are non-all-in players who haven't acted, betting isn't complete
      if (nonAllInPlayers.some(p => !p.hasActed)) {
        return false;
      }
    }
    
    // For postflop rounds, we need to ensure that action has gone around the table at least once
    // and that all players have acted and bets are equal
    if (this.gamePhase !== 'preflop') {
      // Check if we've gone around the table at least once
      const currentPlayer = this.players[this.currentPlayer];
      if (currentPlayer && !currentPlayer.hasActed) {
        return false;
      }
      
      // Additional check: ensure that action has gone around the table at least once
      // and that all players have acted and bets are equal
      if (allBetsEqual && allActed) {
        // Check if we've gone around the table at least once by ensuring
        // that the current player has acted and we're back to the first player who acted
        const firstToAct = (this.dealer + 1) % this.players.length;
        let count = 0;
        while ((this.players[firstToAct].folded || !this.players[firstToAct].isActive) && count < this.players.length) {
          firstToAct = (firstToAct + 1) % this.players.length;
          count++;
        }
        
        // If we're back to the first player to act and they've acted, betting round is complete
        if (this.currentPlayer === firstToAct && this.players[firstToAct].hasActed) {
          return true;
        }
      }
    }
    
    return allBetsEqual && allActed;
  }

  /**
   * Check if all players are all-in
   */
  areAllPlayersAllIn() {
    const activePlayers = this.players.filter(p => !p.folded && p.isActive);
    return activePlayers.length > 0 && activePlayers.every(p => p.allIn);
  }

  /**
   * Check if this is an all-in showdown
   */
  isAllInShowdown() {
    const activePlayers = this.players.filter(p => !p.folded && p.isActive);
    return activePlayers.length > 1 && activePlayers.every(p => p.allIn);
  }

  /**
   * Check if there's a multi-way all-in (3+ players all-in)
   */
  isMultiWayAllIn() {
    const activePlayers = this.players.filter(p => !p.folded && p.isActive);
    const allInPlayers = activePlayers.filter(p => p.allIn);
    return allInPlayers.length >= 3;
  }

  /**
   * Check if there's only one player remaining
   */
  hasOnlyOnePlayer() {
    const activePlayers = this.players.filter(p => !p.folded && p.isActive);
    return activePlayers.length <= 1;
  }

  /**
   * Determine winner(s) of the hand
   */
  determineWinner() {
    const activePlayers = this.players.filter(p => !p.folded && p.isActive);
    
    if (activePlayers.length === 1) {
      // Single player remaining - they win the pot
      const winner = activePlayers[0];
      winner.stack += this.pot;
      this.pot = 0;
      return {
        winner: winner,
        winningHand: null,
        pot: this.pot
      };
    }

    // Evaluate hands for all active players
    const evaluations = activePlayers.map(player => ({
      player,
      evaluation: this.handEvaluator.evaluateHand(player.cards, this.communityCards)
    }));

    // Find best hand
    const bestEvaluation = evaluations.reduce((best, current) => {
      if (current.evaluation.rank > best.evaluation.rank) {
        return current;
      }
      if (current.evaluation.rank === best.evaluation.rank) {
        // Compare kickers
        for (let i = 0; i < Math.min(current.evaluation.kickers.length, best.evaluation.kickers.length); i++) {
          if (current.evaluation.kickers[i] > best.evaluation.kickers[i]) {
            return current;
          }
          if (current.evaluation.kickers[i] < best.evaluation.kickers[i]) {
            return best;
          }
        }
      }
      return best;
    });

    // Distribute pot to winner
    const winner = bestEvaluation.player;
    winner.stack += this.pot;
    this.pot = 0;

    return {
      winner: winner,
      winningHand: bestEvaluation.evaluation,
      pot: this.pot
    };
  }

  /**
   * Calculate side pots for all-in situations
   */
  calculateSidePots() {
    const activePlayers = this.players.filter(p => !p.folded);
    const allInPlayers = activePlayers.filter(p => p.allIn);
    
    if (allInPlayers.length === 0) {
      return { mainPot: this.pot, sidePots: [] };
    }

    // Sort players by bet amount
    const sortedPlayers = [...activePlayers].sort((a, b) => a.bet - b.bet);
    
    const pots = [];
    let remainingPlayers = [...sortedPlayers];
    let currentPot = 0;

    for (let i = 0; i < sortedPlayers.length; i++) {
      const currentPlayer = sortedPlayers[i];
      const currentBet = currentPlayer.bet;
      
      // Calculate pot for this bet level
      let potAmount = 0;
      const eligiblePlayers = remainingPlayers.filter(p => p.bet >= currentBet);
      
      for (const player of remainingPlayers) {
        const contribution = Math.min(player.bet, currentBet);
        potAmount += contribution;
        player.bet -= contribution;
      }

      if (potAmount > 0) {
        pots.push({
          amount: potAmount,
          eligiblePlayers: eligiblePlayers.map(p => p.id)
        });
      }

      // Remove players who are all-in at this level
      remainingPlayers = remainingPlayers.filter(p => p.bet > 0 || !p.allIn);
    }

    return {
      mainPot: pots.length > 0 ? pots[0].amount : this.pot,
      sidePots: pots.slice(1)
    };
  }

  /**
   * Check for busted players
   */
  getBustedPlayers() {
    return this.players.filter(p => p.stack <= 0 && p.isActive);
  }

  /**
   * Check if game should end due to insufficient players
   */
  hasInsufficientPlayers() {
    const activePlayers = this.players.filter(p => !p.folded && p.isActive);
    return activePlayers.length < 2;
  }

  /**
   * Get player view (for sending to client)
   */
  getPlayerView(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return null;

    return {
      id: player.id,
      name: player.name,
      stack: player.stack,
      bet: player.bet,
      folded: player.folded,
      allIn: player.allIn,
      isActive: player.isActive,
      hasActed: player.hasActed,
      cards: player.cards // Include cards for the requesting player
    };
  }

  /**
   * Get current game state
   */
  getState(showCards = false) {
    return {
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        stack: p.stack,
        bet: p.bet,
        folded: p.folded,
        allIn: p.allIn,
        isActive: p.isActive,
        hasActed: p.hasActed,
        cards: showCards ? [...p.cards] : []
      })),
      communityCards: [...this.communityCards],
      pot: this.pot,
      currentBet: this.currentBet,
      currentPlayer: this.currentPlayer,
      gamePhase: this.gamePhase,
      dealer: this.dealer,
      lastAction: this.lastAction,
      bustedPlayers: [...this.bustedPlayers]
    };
  }

  /**
   * Reset game for new hand
   */
  resetForNewHand() {
    // Reset player states
    this.players.forEach(player => {
      player.bet = 0;
      player.folded = false;
      player.allIn = false;
      player.hasActed = false;
      player.cards = [];
    });

    // Reset game state
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.gamePhase = 'preflop';
    this.lastAction = null;

    // Move dealer to next active player
    if (this.players.length > 1) {
      let nextDealer = (this.dealer + 1) % this.players.length;
      let count = 0;
      while (!this.players[nextDealer].isActive && count < this.players.length) {
        nextDealer = (nextDealer + 1) % this.players.length;
        count++;
      }
      this.dealer = nextDealer;
    }
  }

  /**
   * Get game statistics
   */
  getStats() {
    return {
      totalPlayers: this.players.length,
      activePlayers: this.players.filter(p => !p.folded && p.isActive).length,
      allInPlayers: this.players.filter(p => p.allIn).length,
      bustedPlayers: this.bustedPlayers.length,
      pot: this.pot,
      phase: this.gamePhase
    };
  }

  addPlayer(player) {
    return this.playerManager.addPlayer(player);
  }
}

module.exports = { PokerGame }; 