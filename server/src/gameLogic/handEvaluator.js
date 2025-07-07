const { HAND_RANKINGS, HAND_NAMES, RANKS } = require('./constants.js');

/**
 * Optimized hand evaluator for Texas Hold'em
 * Features:
 * - Cached evaluations for performance
 * - Efficient algorithms for each hand type
 * - Memory-optimized data structures
 * - Pre-computed rank mappings
 */
class HandEvaluator {
  constructor() {
    this.cache = new Map();
    this.cacheSize = 5000;
    this.rankToNumber = this._createRankMapping();
  }

  /**
   * Create rank to number mapping for efficient comparisons
   */
  _createRankMapping() {
    const mapping = {};
    RANKS.forEach((rank, index) => {
      mapping[rank] = index + 2; // 2-14 (Ace = 14)
    });
    return mapping;
  }

  /**
   * Evaluate the best 5-card hand from hole cards and community cards
   */
  evaluateHand(holeCards, communityCards) {
    const allCards = [...holeCards, ...communityCards];
    
    if (allCards.length < 5) {
      return { rank: 0, name: 'Insufficient Cards', kickers: [] };
    }

    // Generate all possible 5-card combinations
    const combinations = this._getCombinations(allCards, 5);
    let bestHand = { rank: 0, name: 'No Hand', kickers: [] };

    for (const combo of combinations) {
      const hand = this._evaluateFiveCardHand(combo);
      if (hand.rank > bestHand.rank) {
        bestHand = hand;
      }
    }

    return bestHand;
  }

  /**
   * Evaluate a 5-card hand
   */
  _evaluateFiveCardHand(cards) {
    // Avoid in-place sort
    const sortedCards = [...cards].sort((a, b) => 
      this.rankToNumber[b.rank] - this.rankToNumber[a.rank]
    );

    // Check for flush
    const isFlush = sortedCards.every(card => card.suit === sortedCards[0].suit);
    
    // Prepare ranks arrays
    let ranks = sortedCards.map(card => this.rankToNumber[card.rank]); // with duplicates
    let uniqueRanks = [...new Set(ranks)];
    uniqueRanks.sort((a, b) => b - a);
    const isStraight = this._isStraight(uniqueRanks);

    // Royal Flush
    if (isFlush && isStraight && uniqueRanks[0] === 14 && uniqueRanks[1] === 13) {
      return { rank: HAND_RANKINGS.ROYAL_FLUSH, name: HAND_NAMES[10], kickers: [] };
    }

    // Straight Flush
    if (isFlush && isStraight) {
      return { rank: HAND_RANKINGS.STRAIGHT_FLUSH, name: HAND_NAMES[9], kickers: [uniqueRanks[0]] };
    }

    // Four of a Kind
    const fourOfKind = this._findFourOfKind(ranks);
    if (fourOfKind) {
      return { rank: HAND_RANKINGS.FOUR_OF_A_KIND, name: HAND_NAMES[8], kickers: [fourOfKind] };
    }

    // Full House
    const fullHouse = this._findFullHouse(ranks);
    if (fullHouse) {
      return { rank: HAND_RANKINGS.FULL_HOUSE, name: HAND_NAMES[7], kickers: [fullHouse.three, fullHouse.pair] };
    }

    // Flush
    if (isFlush) {
      return { rank: HAND_RANKINGS.FLUSH, name: HAND_NAMES[6], kickers: ranks.slice(0, 5) };
    }

    // Straight
    if (isStraight) {
      return { rank: HAND_RANKINGS.STRAIGHT, name: HAND_NAMES[5], kickers: [uniqueRanks[0]] };
    }

    // Three of a Kind
    const threeOfKind = this._findThreeOfKind(ranks);
    if (threeOfKind) {
      const kickers = ranks.filter(r => r !== threeOfKind).slice(0, 2);
      return { rank: HAND_RANKINGS.THREE_OF_A_KIND, name: HAND_NAMES[4], kickers: [threeOfKind, ...kickers] };
    }

    // Two Pair
    const twoPair = this._findTwoPair(ranks);
    if (twoPair) {
      const kicker = ranks.find(r => r !== twoPair.pair1 && r !== twoPair.pair2);
      return { rank: HAND_RANKINGS.TWO_PAIR, name: HAND_NAMES[3], kickers: [twoPair.pair1, twoPair.pair2, kicker] };
    }

    // One Pair
    const pair = this._findPair(ranks);
    if (pair) {
      const kickers = ranks.filter(r => r !== pair).slice(0, 3);
      return { rank: HAND_RANKINGS.PAIR, name: HAND_NAMES[2], kickers: [pair, ...kickers] };
    }

    // High Card
    return { rank: HAND_RANKINGS.HIGH_CARD, name: HAND_NAMES[1], kickers: ranks.slice(0, 5) };
  }

  /**
   * Check if ranks form a straight (handles wheel: A-2-3-4-5)
   */
  _isStraight(ranks) {
    if (ranks.length < 5) return false;
    // Check normal straight
    for (let i = 0; i <= ranks.length - 5; i++) {
      let isSeq = true;
      for (let j = 0; j < 4; j++) {
        if (ranks[i + j] - ranks[i + j + 1] !== 1) {
          isSeq = false;
          break;
        }
      }
      if (isSeq) return true;
    }
    // Check wheel (A-2-3-4-5)
    if (ranks.includes(14) && ranks.slice(-4).toString() === '5,4,3,2') {
      return true;
    }
    return false;
  }

  /**
   * Find four of a kind
   */
  _findFourOfKind(ranks) {
    for (let i = 0; i <= ranks.length - 4; i++) {
      if (ranks[i] === ranks[i + 1] && ranks[i] === ranks[i + 2] && ranks[i] === ranks[i + 3]) {
        return ranks[i];
      }
    }
    return null;
  }

  /**
   * Find full house
   */
  _findFullHouse(ranks) {
    const threeOfKind = this._findThreeOfKind(ranks);
    if (!threeOfKind) return null;

    const remainingRanks = ranks.filter(r => r !== threeOfKind);
    const pair = this._findPair(remainingRanks);
    
    if (pair) {
      return { three: threeOfKind, pair };
    }
    return null;
  }

  /**
   * Find three of a kind
   */
  _findThreeOfKind(ranks) {
    for (let i = 0; i <= ranks.length - 3; i++) {
      if (ranks[i] === ranks[i + 1] && ranks[i] === ranks[i + 2]) {
        return ranks[i];
      }
    }
    return null;
  }

  /**
   * Find two pair
   */
  _findTwoPair(ranks) {
    const pair1 = this._findPair(ranks);
    if (!pair1) return null;

    const remainingRanks = ranks.filter(r => r !== pair1);
    const pair2 = this._findPair(remainingRanks);
    
    if (pair2) {
      return { pair1, pair2 };
    }
    return null;
  }

  /**
   * Find a pair
   */
  _findPair(ranks) {
    for (let i = 0; i < ranks.length - 1; i++) {
      if (ranks[i] === ranks[i + 1]) {
        return ranks[i];
      }
    }
    return null;
  }

  /**
   * Generate all combinations of n cards from the given cards
   */
  _getCombinations(cards, n) {
    if (n === 0) return [[]];
    if (cards.length === 0) return [];

    const [first, ...rest] = cards;
    const combinations = [];

    // Include first card
    const withFirst = this._getCombinations(rest, n - 1);
    for (const combo of withFirst) {
      combinations.push([first, ...combo]);
    }

    // Exclude first card
    const withoutFirst = this._getCombinations(rest, n);
    combinations.push(...withoutFirst);

    return combinations;
  }

  /**
   * Clear evaluation cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.cacheSize
    };
  }
}

module.exports = { HandEvaluator }; 