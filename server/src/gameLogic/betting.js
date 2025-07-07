const { DEFAULT_BLINDS } = require('./constants.js');

/**
 * Optimized betting management for Texas Hold'em
 * Features:
 * - Side pot calculation for all-in situations
 * - Efficient bet validation
 * - Memory-optimized pot tracking
 * - All-in detection and handling
 */
class BettingManager {
  constructor() {
    this.pot = 0;
    this.sidePots = [];
    this.currentBet = 0;
    this.lastRaise = 0;
    this.minRaise = 0;
  }

  /**
   * Initialize betting for a new hand
   */
  initializeBetting(blinds = DEFAULT_BLINDS) {
    this.pot = 0;
    this.sidePots = [];
    this.currentBet = 0;
    this.lastRaise = 0;
    this.minRaise = blinds.big;
  }

  /**
   * Process a player action
   */
  processAction(player, action, amount = 0, players = []) {
    const oldStack = player.stack;
    const oldBet = player.bet;

    switch (action) {
      case 'fold':
        if (player.allIn) {
          throw new Error('All-in players cannot fold');
        }
        player.folded = true;
        break;

      case 'check':
        if (this.currentBet > player.bet) {
          throw new Error('Cannot check when there is a bet to call');
        }
        // If this is a check and the player's bet equals the current bet, reset current bet to 0
        // This handles the case where the big blind checks in heads-up preflop
        if (player.bet >= this.currentBet) {
          console.log(`Check action: player ${player.name} bet ${player.bet}, currentBet was ${this.currentBet}, resetting to 0`);
          this.currentBet = 0;
        }
        break;

      case 'call':
        // The amount needed to call is the difference between the current bet and what the player has already bet
        const needed = Math.min(this.currentBet, player.stack + player.bet) - player.bet;
        if (needed >= player.stack) {
          // All-in call for remaining stack
          this._processAllIn(player, player.stack);
        } else {
          player.stack -= needed;
          player.bet += needed;
        }
        break;

      case 'raise':
        if (amount < this.minRaise && amount < player.stack) {
          throw new Error(`Raise must be at least ${this.minRaise}`);
        }
        if (amount > player.stack) {
          throw new Error(`Cannot raise more than your stack (${player.stack})`);
        }
        if (amount >= player.stack) {
          // All-in raise
          this._processAllIn(player, player.stack);
        } else {
          const totalBet = player.bet + amount;
          player.stack -= amount;
          player.bet = totalBet;
          this.currentBet = totalBet;
          this.lastRaise = amount;
          this.minRaise = amount;
        }
        break;

      case 'allIn':
        this._processAllIn(player, player.stack);
        break;

      default:
        throw new Error(`Invalid action: ${action}`);
    }

    // Update pot
    this.pot = this._calculateTotalPot(players);
    
    return {
      oldStack,
      oldBet,
      newStack: player.stack,
      newBet: player.bet,
      action,
      amount
    };
  }

  /**
   * Process all-in action
   */
  _processAllIn(player, amount) {
    player.stack = 0;
    player.bet += amount;
    player.allIn = true;
    
    if (player.bet > this.currentBet) {
      this.currentBet = player.bet;
      this.lastRaise = player.bet - this.currentBet;
      this.minRaise = this.lastRaise;
    }
  }

  /**
   * Calculate side pots for all-in situations
   */
  calculateSidePots(players) {
    const activePlayers = players.filter(p => !p.folded);
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
   * Determine winners for each pot
   */
  determineWinners(pots, players, handEvaluator) {
    const winners = [];

    for (const pot of pots) {
      const eligiblePlayers = players.filter(p => 
        pot.eligiblePlayers.includes(p.id) && !p.folded
      );

      if (eligiblePlayers.length === 1) {
        winners.push({
          pot: pot.amount,
          winner: eligiblePlayers[0],
          hand: null
        });
      } else {
        // Evaluate hands for all eligible players
        const evaluations = eligiblePlayers.map(player => ({
          player,
          evaluation: handEvaluator.evaluateHand(player.cards, this.communityCards)
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

        winners.push({
          pot: pot.amount,
          winner: bestEvaluation.player,
          hand: bestEvaluation.evaluation
        });
      }
    }

    return winners;
  }

  /**
   * Check if betting round is complete
   */
  isBettingRoundComplete(players) {
    const activePlayers = players.filter(p => !p.folded && p.isActive);
    
    if (activePlayers.length <= 1) return true;

    // Check if all active players have acted and bets are equal
    const maxBet = Math.max(...activePlayers.map(p => p.bet));
    const allBetsEqual = activePlayers.every(p => p.bet === maxBet);
    
    // Check if all players have acted
    const allActed = activePlayers.every(p => p.hasActed || p.allIn);
    
    return allBetsEqual && allActed;
  }

  /**
   * Get minimum raise amount
   */
  getMinRaise(currentBet, bigBlind) {
    return Math.max(this.lastRaise, bigBlind);
  }

  /**
   * Calculate total pot including side pots
   */
  _calculateTotalPot(players = []) {
    let total = 0;
    for (const player of players) {
      total += player.bet;
    }
    return total;
  }

  /**
   * Reset betting for new hand
   */
  reset() {
    this.pot = 0;
    this.sidePots = [];
    this.currentBet = 0;
    this.lastRaise = 0;
    this.minRaise = 0;
  }

  /**
   * Get betting state
   */
  getState() {
    return {
      pot: this.pot,
      currentBet: this.currentBet,
      lastRaise: this.lastRaise,
      minRaise: this.minRaise,
      sidePots: this.sidePots
    };
  }
}

module.exports = { BettingManager }; 