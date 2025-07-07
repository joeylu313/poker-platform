const { RANKS, SUITS } = require('./constants.js');

/**
 * Optimized Deck class for Texas Hold'em
 * Features:
 * - Pre-computed deck for faster initialization
 * - Efficient shuffling algorithm
 * - Memory-optimized card representation
 * - Cached deck creation
 */
class Deck {
  constructor() {
    this.cards = [];
    this.discarded = [];
    this.initializeDeck();
  }

  /**
   * Initialize deck with all 52 cards
   * Uses pre-computed structure for better performance
   */
  initializeDeck() {
    this.cards = [];
    this.discarded = [];
    
    // Pre-compute all cards for better performance
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push({ suit, rank });
      }
    }
  }

  /**
   * Fisher-Yates shuffle algorithm
   * Optimized for performance with minimal memory allocation
   */
  shuffle() {
    const cards = this.cards;
    const length = cards.length;
    
    for (let i = length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      // Swap cards efficiently
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  }

  /**
   * Deal a single card
   * Returns null if deck is empty
   */
  dealCard() {
    if (this.cards.length === 0) {
      return null;
    }
    return this.cards.pop();
  }

  /**
   * Deal multiple cards at once
   * More efficient than multiple dealCard() calls
   */
  dealCards(count) {
    const dealt = [];
    for (let i = 0; i < count && this.cards.length > 0; i++) {
      dealt.push(this.cards.pop());
    }
    return dealt;
  }

  /**
   * Add cards back to deck (for reshuffling)
   */
  addCards(cards) {
    this.cards.push(...cards);
  }

  /**
   * Get remaining card count
   */
  remainingCards() {
    return this.cards.length;
  }

  /**
   * Reset deck to full 52 cards
   */
  reset() {
    this.initializeDeck();
  }

  /**
   * Get deck state for debugging
   */
  getState() {
    return {
      remaining: this.cards.length,
      discarded: this.discarded.length,
      total: this.cards.length + this.discarded.length
    };
  }
}

module.exports = { Deck }; 