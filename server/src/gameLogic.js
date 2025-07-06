// Texas Hold'em poker game logic
class PokerGame {
  constructor() {
    this.deck = [];
    this.communityCards = [];
    this.pot = 0;
    this.currentBet = 0;
    this.currentPlayer = 0;
    this.gamePhase = 'preflop'; // preflop, flop, turn, river, showdown
    this.lastAction = null;
    this.players = [];
    this.dealer = 0;
    this.smallBlind = 10;
    this.bigBlind = 20;
    this.roundStartPlayer = 0;
    this.lastRaisePlayer = -1;
  }

  // Initialize a new game
  initializeGame(players, blinds) {
    this.players = players.map(player => ({
      ...player,
      cards: [],
      bet: 0,
      folded: false,
      allIn: false,
      hasActed: false
    }));
    this.smallBlind = blinds.small;
    this.bigBlind = blinds.big;
    this.pot = 0;
    this.currentBet = 0;
    this.communityCards = [];
    this.gamePhase = 'preflop';
    this.dealer = (this.dealer + 1) % this.players.length;
    this.currentPlayer = (this.dealer + 3) % this.players.length; // UTG position
    this.roundStartPlayer = this.currentPlayer;
    this.lastRaisePlayer = -1;
    
    // Post blinds
    const sbPos = (this.dealer + 1) % this.players.length;
    const bbPos = (this.dealer + 2) % this.players.length;
    
    this.players[sbPos].bet = this.smallBlind;
    this.players[sbPos].stack -= this.smallBlind;
    this.pot += this.smallBlind;
    
    this.players[bbPos].bet = this.bigBlind;
    this.players[bbPos].stack -= this.bigBlind;
    this.pot += this.bigBlind;
    
    this.currentBet = this.bigBlind;
    
    // Reset action flags
    for (let player of this.players) {
      player.hasActed = false;
    }
    
    return this.getGameState();
  }

  // Create and shuffle deck
  createDeck() {
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    this.deck = [];
    
    for (let suit of suits) {
      for (let rank of ranks) {
        this.deck.push({ suit, rank });
      }
    }
    
    // Shuffle deck
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  // Deal hole cards to players
  dealHoleCards() {
    this.createDeck();
    
    // Deal 2 cards to each active player
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < this.players.length; j++) {
        if (!this.players[j].folded) {
          this.players[j].cards.push(this.deck.pop());
        }
      }
    }
  }

  // Deal community cards
  dealCommunityCards() {
    if (this.gamePhase === 'preflop') {
      // Deal flop (3 cards)
      for (let i = 0; i < 3; i++) {
        this.communityCards.push(this.deck.pop());
      }
      this.gamePhase = 'flop';
    } else if (this.gamePhase === 'flop') {
      // Deal turn (1 card)
      this.communityCards.push(this.deck.pop());
      this.gamePhase = 'turn';
    } else if (this.gamePhase === 'turn') {
      // Deal river (1 card)
      this.communityCards.push(this.deck.pop());
      this.gamePhase = 'river';
    } else if (this.gamePhase === 'river') {
      // Showdown
      this.gamePhase = 'showdown';
      return this.determineWinner();
    }
    
    this.currentBet = 0;
    this.currentPlayer = (this.dealer + 1) % this.players.length;
    this.roundStartPlayer = this.currentPlayer;
    this.lastRaisePlayer = -1;
    
    // Reset bets and action flags for new round
    for (let player of this.players) {
      player.bet = 0;
      player.hasActed = false;
    }
    
    // Skip to first active player
    while (this.players[this.currentPlayer].folded) {
      this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    }
    
    return this.getGameState();
  }

  // Handle player action
  handlePlayerAction(playerId, action, amount = 0) {
    const playerIndex = this.players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) return null;
    
    const player = this.players[playerIndex];
    
    // Check if it's this player's turn
    if (this.currentPlayer !== playerIndex) {
      console.log(`Not player ${playerIndex}'s turn. Current player: ${this.currentPlayer}`);
      return null;
    }
    
    // Check if player is folded
    if (player.folded) {
      console.log(`Player ${playerIndex} is folded and cannot act`);
      return null;
    }
    
    switch (action) {
      case 'fold':
        player.folded = true;
        player.hasActed = true;
        break;
        
      case 'call':
        const callAmount = this.currentBet - player.bet;
        if (callAmount > player.stack) {
          // All-in
          player.bet += player.stack;
          this.pot += player.stack;
          player.stack = 0;
          player.allIn = true;
        } else {
          player.bet += callAmount;
          player.stack -= callAmount;
          this.pot += callAmount;
        }
        player.hasActed = true;
        break;
        
      case 'raise':
        const totalBet = player.bet + amount;
        if (totalBet <= this.currentBet) {
          console.log('Invalid raise amount');
          return null;
        }
        
        if (amount > player.stack) {
          // All-in
          player.bet += player.stack;
          this.pot += player.stack;
          player.stack = 0;
          player.allIn = true;
          this.currentBet = player.bet;
        } else {
          player.bet += amount;
          player.stack -= amount;
          this.pot += amount;
          this.currentBet = player.bet;
        }
        this.lastRaisePlayer = playerIndex;
        player.hasActed = true;
        break;
        
      case 'check':
        if (this.currentBet > player.bet) {
          console.log('Cannot check when there is a bet');
          return null;
        }
        player.hasActed = true;
        break;
    }
    
    this.lastAction = { playerId, action, amount };
    this.moveToNextPlayer();
    
    return this.getGameState();
  }

  // Move to next active player
  moveToNextPlayer() {
    do {
      this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
    } while (this.players[this.currentPlayer].folded);
  }

  // Check if betting round is complete
  isBettingRoundComplete() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    // If only one player left, round is complete
    if (activePlayers.length <= 1) {
      return true;
    }
    
    // Check if all active players have acted and bets are equal
    const allBetsEqual = activePlayers.every(p => p.bet === this.currentBet || p.allIn);
    const allPlayersActed = activePlayers.every(p => p.hasActed || p.allIn);
    
    // Additional check: if someone raised, we need to go around again
    const needsMoreAction = this.lastRaisePlayer !== -1 && 
                           this.currentPlayer !== this.roundStartPlayer;
    
    return allBetsEqual && allPlayersActed && !needsMoreAction;
  }

  // Determine winner
  determineWinner() {
    const activePlayers = this.players.filter(p => !p.folded);
    
    if (activePlayers.length === 1) {
      // Only one player left, they win
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
    const playerHands = activePlayers.map(player => {
      const hand = this.evaluateHand(player.cards, this.communityCards);
      return {
        player: player,
        hand: hand
      };
    });
    
    // Find the best hand
    const bestHand = playerHands.reduce((best, current) => {
      if (current.hand.rank > best.hand.rank) {
        return current;
      } else if (current.hand.rank === best.hand.rank) {
        // Compare kickers
        for (let i = 0; i < current.hand.kickers.length; i++) {
          if (current.hand.kickers[i] > best.hand.kickers[i]) {
            return current;
          } else if (current.hand.kickers[i] < best.hand.kickers[i]) {
            return best;
          }
        }
        // Tie - split pot
        return best;
      }
      return best;
    });
    
    // Award pot to winner
    bestHand.player.stack += this.pot;
    this.pot = 0;
    
    return {
      winner: bestHand.player,
      winningHand: bestHand.hand,
      pot: this.pot
    };
  }

  // Evaluate poker hand
  evaluateHand(holeCards, communityCards) {
    const allCards = [...holeCards, ...communityCards];
    const combinations = this.getCombinations(allCards, 5);
    
    let bestHand = { rank: 0, name: 'High Card', kickers: [] };
    
    for (const combo of combinations) {
      const hand = this.evaluateFiveCardHand(combo);
      if (hand.rank > bestHand.rank) {
        bestHand = hand;
      }
    }
    
    return bestHand;
  }

  // Get all combinations of n cards from array
  getCombinations(cards, n) {
    if (n === 0) return [[]];
    if (cards.length === 0) return [];
    
    const [first, ...rest] = cards;
    const withoutFirst = this.getCombinations(rest, n);
    const withFirst = this.getCombinations(rest, n - 1).map(combo => [first, ...combo]);
    
    return [...withoutFirst, ...withFirst];
  }

  // Evaluate a 5-card hand
  evaluateFiveCardHand(cards) {
    const ranks = cards.map(card => this.rankToNumber(card.rank)).sort((a, b) => b - a);
    const suits = cards.map(card => card.suit);
    const rankCounts = {};
    
    ranks.forEach(rank => {
      rankCounts[rank] = (rankCounts[rank] || 0) + 1;
    });
    
    const isFlush = suits.every(suit => suit === suits[0]);
    const isStraight = this.isStraight(ranks);
    
    // Check for straight flush
    if (isFlush && isStraight) {
      return { rank: 8, name: 'Straight Flush', kickers: ranks };
    }
    
    // Check for four of a kind
    const fourRank = Object.keys(rankCounts).find(rank => rankCounts[rank] === 4);
    if (fourRank) {
      const kicker = ranks.find(rank => rank !== parseInt(fourRank));
      return { rank: 7, name: 'Four of a Kind', kickers: [parseInt(fourRank), kicker] };
    }
    
    // Check for full house
    const threeRank = Object.keys(rankCounts).find(rank => rankCounts[rank] === 3);
    const twoRank = Object.keys(rankCounts).find(rank => rankCounts[rank] === 2);
    if (threeRank && twoRank) {
      return { rank: 6, name: 'Full House', kickers: [parseInt(threeRank), parseInt(twoRank)] };
    }
    
    // Check for flush
    if (isFlush) {
      return { rank: 5, name: 'Flush', kickers: ranks };
    }
    
    // Check for straight
    if (isStraight) {
      return { rank: 4, name: 'Straight', kickers: ranks };
    }
    
    // Check for three of a kind
    if (threeRank) {
      const kickers = ranks.filter(rank => rank !== parseInt(threeRank));
      return { rank: 3, name: 'Three of a Kind', kickers: [parseInt(threeRank), ...kickers] };
    }
    
    // Check for two pair
    const pairs = Object.keys(rankCounts).filter(rank => rankCounts[rank] === 2).map(Number).sort((a, b) => b - a);
    if (pairs.length === 2) {
      const kicker = ranks.find(rank => !pairs.includes(rank));
      return { rank: 2, name: 'Two Pair', kickers: [...pairs, kicker] };
    }
    
    // Check for one pair
    if (pairs.length === 1) {
      const kickers = ranks.filter(rank => rank !== pairs[0]);
      return { rank: 1, name: 'One Pair', kickers: [pairs[0], ...kickers] };
    }
    
    // High card
    return { rank: 0, name: 'High Card', kickers: ranks };
  }

  // Convert rank to number
  rankToNumber(rank) {
    const rankMap = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
      '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return rankMap[rank];
  }

  // Check if ranks form a straight
  isStraight(ranks) {
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b);
    if (uniqueRanks.length < 5) return false;
    
    // Check for regular straight
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
      if (uniqueRanks[i + 4] - uniqueRanks[i] === 4) {
        return true;
      }
    }
    
    // Check for A-2-3-4-5 straight (wheel)
    if (uniqueRanks.includes(14) && uniqueRanks.includes(2)) {
      const lowRanks = uniqueRanks.filter(r => r <= 5);
      if (lowRanks.length >= 4 && lowRanks.includes(2) && lowRanks.includes(3) && 
          lowRanks.includes(4) && lowRanks.includes(5)) {
        return true;
      }
    }
    
    return false;
  }

  // Get current game state
  getGameState() {
    return {
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        stack: p.stack,
        bet: p.bet,
        folded: p.folded,
        allIn: p.allIn,
        cards: p.cards // Only show to the player themselves
      })),
      communityCards: this.communityCards,
      pot: this.pot,
      currentBet: this.currentBet,
      currentPlayer: this.currentPlayer,
      gamePhase: this.gamePhase,
      dealer: this.dealer,
      lastAction: this.lastAction
    };
  }

  // Get player's view (with their own cards)
  getPlayerView(playerId) {
    const gameState = this.getGameState();
    const player = this.players.find(p => p.id === playerId);
    
    if (player) {
      gameState.players = gameState.players.map(p => ({
        ...p,
        cards: p.id === playerId ? p.cards : [] // Only show own cards
      }));
    }
    
    return gameState;
  }
}

module.exports = PokerGame; 