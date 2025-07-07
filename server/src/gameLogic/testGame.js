const { PokerGame } = require('./PokerGame');

// Test suite for Texas Hold'em rules compliance
class PokerTestSuite {
  constructor() {
    this.testsRun = 0;
    this.testsPassed = 0;
    this.testsFailed = 0;
  }

  // Helper to print game state
  printState(game, label = '') {
    const state = game.getState(true);
    console.log(`\n=== ${label} ===`);
    console.log('Players:');
    state.players.forEach((p, i) => {
      console.log(`  [${i}] ${p.name} | stack: ${p.stack} | bet: ${p.bet} | folded: ${p.folded} | allIn: ${p.allIn} | cards: ${JSON.stringify(p.cards)}`);
    });
    console.log('Community:', state.communityCards);
    console.log('Pot:', state.pot, '| Current Bet:', state.currentBet, '| Phase:', state.gamePhase, '| Dealer:', state.dealer);
    if (state.lastAction) console.log('Last Action:', state.lastAction);
  }

  // Test assertion helper
  assert(condition, message) {
    this.testsRun++;
    if (condition) {
      this.testsPassed++;
      console.log(`✅ PASS: ${message}`);
    } else {
      this.testsFailed++;
      console.log(`❌ FAIL: ${message}`);
    }
  }

  // Test exception helper
  assertThrows(func, expectedError, message) {
    this.testsRun++;
    try {
      func();
      this.testsFailed++;
      console.log(`❌ FAIL: ${message} - Expected error but none thrown`);
    } catch (error) {
      if (error.message.includes(expectedError)) {
        this.testsPassed++;
        console.log(`✅ PASS: ${message}`);
      } else {
        this.testsFailed++;
        console.log(`❌ FAIL: ${message} - Expected "${expectedError}" but got "${error.message}"`);
      }
    }
  }

  // Print test summary
  printSummary() {
    console.log(`\n=== TEST SUMMARY ===`);
    console.log(`Tests Run: ${this.testsRun}`);
    console.log(`Tests Passed: ${this.testsPassed}`);
    console.log(`Tests Failed: ${this.testsFailed}`);
    console.log(`Success Rate: ${((this.testsPassed / this.testsRun) * 100).toFixed(1)}%`);
  }

  // ===== TEST CATEGORIES =====

  // 1. Deck and Card Handling Tests
  testDeckAndCards() {
    console.log('\n🧪 TESTING: Deck and Card Handling');
    
    const game = new PokerGame();
    const players = [
      { id: 'p1', name: 'Alice', stack: 1000, isActive: true },
      { id: 'p2', name: 'Bob', stack: 1000, isActive: true },
      { id: 'p3', name: 'Carol', stack: 1000, isActive: true }
    ];
    
    game.initializeGame(players, { small: 10, big: 20 });
    game.dealHoleCards();
    
    // Test 1: Each player has exactly 2 cards
    const state = game.getState(true);
    state.players.forEach(player => {
      this.assert(player.cards.length === 2, `Player ${player.name} has exactly 2 cards`);
    });
    
    // Test 2: All cards are valid (have suit and rank)
    state.players.forEach(player => {
      player.cards.forEach(card => {
        this.assert(card.suit && card.rank, `Card has valid suit and rank: ${JSON.stringify(card)}`);
        this.assert(['hearts', 'diamonds', 'clubs', 'spades'].includes(card.suit), `Card has valid suit: ${card.suit}`);
        this.assert(['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'].includes(card.rank), `Card has valid rank: ${card.rank}`);
      });
    });
    
    // Test 3: No duplicate cards
    const allCards = state.players.flatMap(p => p.cards);
    const cardStrings = allCards.map(c => `${c.rank}${c.suit}`);
    const uniqueCards = new Set(cardStrings);
    this.assert(uniqueCards.size === allCards.length, 'No duplicate cards dealt');
  }

  // 2. Blinds and Dealer Tests
  testBlindsAndDealer() {
    console.log('\n🧪 TESTING: Blinds and Dealer');
    
    const game = new PokerGame();
    const players = [
      { id: 'p1', name: 'Alice', stack: 1000, isActive: true },
      { id: 'p2', name: 'Bob', stack: 1000, isActive: true },
      { id: 'p3', name: 'Carol', stack: 1000, isActive: true }
    ];
    
    game.initializeGame(players, { small: 10, big: 20 });
    
    const state = game.getState(true);
    
    // Test 1: Blinds are posted correctly
    const activePlayers = state.players.filter(p => p.isActive);
    const sbPos = (state.dealer + 1) % activePlayers.length;
    const bbPos = (state.dealer + 2) % activePlayers.length;
    
    this.assert(activePlayers[sbPos].bet === 10, 'Small blind posted correctly');
    this.assert(activePlayers[bbPos].bet === 20, 'Big blind posted correctly');
    
    // Test 2: Stacks are reduced by blind amounts
    this.assert(activePlayers[sbPos].stack === 990, 'Small blind stack reduced correctly');
    this.assert(activePlayers[bbPos].stack === 980, 'Big blind stack reduced correctly');
    
    // Test 3: Pot contains blind amounts
    this.assert(state.pot === 30, 'Pot contains both blind amounts');
  }

  // 3. Betting Actions Tests
  testBettingActions() {
    console.log('\n🧪 TESTING: Betting Actions');
    
    const game = new PokerGame();
    const players = [
      { id: 'p1', name: 'Alice', stack: 1000, isActive: true },
      { id: 'p2', name: 'Bob', stack: 1000, isActive: true },
      { id: 'p3', name: 'Carol', stack: 1000, isActive: true }
    ];
    
    game.initializeGame(players, { small: 10, big: 20 });
    game.dealHoleCards();
    
    // Test 1: Valid actions work (should not throw errors)
    try {
      game.processPlayerAction('p1', 'call', 0);
      this.assert(true, 'Call action works');
    } catch (error) {
      this.assert(false, 'Call action should work but threw error: ' + error.message);
    }
    
    // Test 2: Invalid actions throw errors
    this.assertThrows(() => {
      game.processPlayerAction('p1', 'invalid_action', 0);
    }, 'Invalid action', 'Invalid action throws error');
    
    // Test 3: Minimum raise enforcement
    this.assertThrows(() => {
      game.processPlayerAction('p2', 'raise', 5); // Less than big blind
    }, 'Raise must be at least', 'Minimum raise enforced');
    
    // Test 4: All-in works (should not throw errors)
    try {
      game.processPlayerAction('p3', 'raise', 980); // Carol has 980 after blinds
      this.assert(true, 'All-in action works');
    } catch (error) {
      this.assert(false, 'All-in action should work but threw error: ' + error.message);
    }
  }

  // 4. All-In and Side Pots Tests
  testAllInAndSidePots() {
    console.log('\n🧪 TESTING: All-In and Side Pots');
    
    const game = new PokerGame();
    const players = [
      { id: 'p1', name: 'Alice', stack: 100, isActive: true },
      { id: 'p2', name: 'Bob', stack: 200, isActive: true },
      { id: 'p3', name: 'Carol', stack: 300, isActive: true }
    ];
    
    game.initializeGame(players, { small: 10, big: 20 });
    game.dealHoleCards();
    
    // Alice goes all-in
    game.processPlayerAction('p1', 'raise', 100);
    let state = game.getState(true);
    console.log('After Alice all-in:');
    state.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.name}, stack: ${p.stack}, bet: ${p.bet}, allIn: ${p.allIn}`);
    });
    this.assert(state.players[0].allIn === true, 'Alice marked as all-in');
    this.assert(state.players[0].stack === 0, 'Alice stack is 0');
    
    // Bob calls
    game.processPlayerAction('p2', 'call', 80);
    state = game.getState(true);
    console.log('After Bob calls:');
    state.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.name}, stack: ${p.stack}, bet: ${p.bet}, allIn: ${p.allIn}`);
    });
    this.assert(state.players[1].stack === 100, 'Bob stack reduced correctly');
    
    // Carol calls
    game.processPlayerAction('p3', 'call', 80);
    state = game.getState(true);
    console.log('After Carol calls:');
    state.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.name}, stack: ${p.stack}, bet: ${p.bet}, allIn: ${p.allIn}`);
    });
    this.assert(state.players[2].stack === 200, 'Carol stack reduced correctly');
    
    // Test pot calculation
    this.assert(state.pot === 300, 'Pot contains all bets');
  }

  // 5. Folding and Pot Award Tests
  testFoldingAndPotAward() {
    console.log('\n🧪 TESTING: Folding and Pot Award');
    
    const game = new PokerGame();
    const players = [
      { id: 'p1', name: 'Alice', stack: 1000, isActive: true },
      { id: 'p2', name: 'Bob', stack: 1000, isActive: true },
      { id: 'p3', name: 'Carol', stack: 1000, isActive: true }
    ];
    
    game.initializeGame(players, { small: 10, big: 20 });
    game.dealHoleCards();
    
    // Bob and Carol fold
    game.processPlayerAction('p2', 'fold', 0);
    game.processPlayerAction('p3', 'fold', 0);
    
    const state = game.getState(true);
    this.assert(state.players[1].folded === true, 'Bob is folded');
    this.assert(state.players[2].folded === true, 'Carol is folded');
    this.assert(state.players[0].folded === false, 'Alice is not folded');
    
    // Alice should win the pot immediately
    this.assert(state.pot === 30, 'Pot contains blinds');
  }

  // 6. Community Cards Tests
  testCommunityCards() {
    console.log('\n🧪 TESTING: Community Cards');
    
    const game = new PokerGame();
    const players = [
      { id: 'p1', name: 'Alice', stack: 1000, isActive: true },
      { id: 'p2', name: 'Bob', stack: 1000, isActive: true }
    ];
    
    game.initializeGame(players, { small: 10, big: 20 });
    game.dealHoleCards();
    
    // Complete preflop betting
    game.processPlayerAction('p1', 'call', 0);
    game.processPlayerAction('p2', 'check', 0);
    
    // Deal flop
    game.dealCommunityCards();
    let state = game.getState(true);
    this.assert(state.communityCards.length === 3, 'Flop has 3 cards');
    this.assert(state.gamePhase === 'flop', 'Game phase is flop');
    
    // Complete flop betting
    game.processPlayerAction('p1', 'check', 0);
    game.processPlayerAction('p2', 'check', 0);
    
    // Deal turn
    game.dealCommunityCards();
    state = game.getState(true);
    this.assert(state.communityCards.length === 4, 'Turn adds 1 card');
    this.assert(state.gamePhase === 'turn', 'Game phase is turn');
    
    // Complete turn betting
    game.processPlayerAction('p1', 'check', 0);
    game.processPlayerAction('p2', 'check', 0);
    
    // Deal river
    game.dealCommunityCards();
    state = game.getState(true);
    this.assert(state.communityCards.length === 5, 'River adds 1 card');
    this.assert(state.gamePhase === 'river', 'Game phase is river');
  }

  // 7. Hand Evaluation Tests
  testHandEvaluation() {
    console.log('\n🧪 TESTING: Hand Evaluation');
    
    const game = new PokerGame();
    const players = [
      { id: 'p1', name: 'Alice', stack: 1000, isActive: true },
      { id: 'p2', name: 'Bob', stack: 1000, isActive: true }
    ];
    
    game.initializeGame(players, { small: 10, big: 20 });
    game.dealHoleCards();
    
    // Force specific hands for testing
    game.players[0].cards = [
      { suit: 'hearts', rank: 'A' },
      { suit: 'spades', rank: 'A' }
    ];
    game.players[1].cards = [
      { suit: 'diamonds', rank: 'K' },
      { suit: 'clubs', rank: 'K' }
    ];
    
    game.communityCards = [
      { suit: 'hearts', rank: 'Q' },
      { suit: 'spades', rank: 'J' },
      { suit: 'diamonds', rank: '10' },
      { suit: 'clubs', rank: '3' },
      { suit: 'hearts', rank: '2' }
    ];
    
    // Test hand evaluation
    const handEvaluator = game.handEvaluator;
    const aliceHand = handEvaluator.evaluateHand(game.players[0].cards, game.communityCards);
    const bobHand = handEvaluator.evaluateHand(game.players[1].cards, game.communityCards);
    console.log('Alice hand evaluation:', JSON.stringify(aliceHand));
    console.log('Bob hand evaluation:', JSON.stringify(bobHand));
    this.assert(aliceHand.name === 'One Pair', 'Alice has one pair (Aces)');
    this.assert(bobHand.name === 'One Pair', 'Bob has one pair (Kings)');
    // Compare hands: if same rank, compare kickers
    if (aliceHand.rank === bobHand.rank) {
      // Compare kickers
      for (let i = 0; i < Math.min(aliceHand.kickers.length, bobHand.kickers.length); i++) {
        if (aliceHand.kickers[i] > bobHand.kickers[i]) {
          this.assert(true, 'Aces beat Kings');
          return;
        } else if (aliceHand.kickers[i] < bobHand.kickers[i]) {
          this.assert(false, 'Aces should beat Kings');
          return;
        }
      }
      this.assert(false, 'Hands are equal');
    } else {
      this.assert(aliceHand.rank > bobHand.rank, 'Aces beat Kings');
    }
  }

  // 8. Heads-Up (2 Players) Tests
  testHeadsUp() {
    console.log('\n🧪 TESTING: Heads-Up Play');
    
    const game = new PokerGame();
    const players = [
      { id: 'p1', name: 'Alice', stack: 1000, isActive: true },
      { id: 'p2', name: 'Bob', stack: 1000, isActive: true }
    ];
    
    game.initializeGame(players, { small: 10, big: 20 });
    
    const state = game.getState(true);
    
    // Test 1: Dealer is small blind
    const activePlayers = state.players.filter(p => p.isActive);
    let sbPos, bbPos;
    
    if (activePlayers.length === 2) {
      // Heads-up: dealer is small blind, other player is big blind
      sbPos = state.dealer;
      bbPos = (state.dealer + 1) % activePlayers.length;
    } else {
      // 3+ players: normal blind assignment
      sbPos = (state.dealer + 1) % activePlayers.length;
      bbPos = (state.dealer + 2) % activePlayers.length;
    }
    
    this.assert(sbPos === 0, 'Dealer is small blind in heads-up');
    
    // Test 2: Other player is big blind
    this.assert(bbPos === 1, 'Other player is big blind in heads-up');
    
    // Test 3: Blinds posted correctly
    this.assert(activePlayers[sbPos].bet === 10, 'Small blind posted in heads-up');
    this.assert(activePlayers[bbPos].bet === 20, 'Big blind posted in heads-up');
  }

  // 9. Edge Cases Tests
  testEdgeCases() {
    console.log('\n🧪 TESTING: Edge Cases');
    
    const game = new PokerGame();
    const players = [
      { id: 'p1', name: 'Alice', stack: 20, isActive: true },
      { id: 'p2', name: 'Bob', stack: 1000, isActive: true }
    ];
    
    game.initializeGame(players, { small: 10, big: 20 });
    game.dealHoleCards();
    
    // Test 1: Short stack all-in
    game.processPlayerAction('p1', 'raise', 10); // Alice has 10 after blinds
    let state = game.getState(true);
    this.assert(state.players[0].allIn === true, 'Short stack goes all-in');
    this.assert(state.players[0].stack === 0, 'Short stack is 0');
    
    // Test 2: Can't bet more than stack
    this.assertThrows(() => {
      game.processPlayerAction('p2', 'raise', 2000);
    }, 'Cannot raise more than your stack', 'Cannot bet more than stack');
    
    // Test 3: All-in players can't act
    this.assertThrows(() => {
      game.processPlayerAction('p1', 'call', 0);
    }, 'All-in players cannot act', 'All-in players cannot act');
  }

  // 10. Betting Round Completion Tests
  testBettingRoundCompletion() {
    console.log('\n🧪 TESTING: Betting Round Completion');
    
    const game = new PokerGame();
    const players = [
      { id: 'p1', name: 'Alice', stack: 1000, isActive: true },
      { id: 'p2', name: 'Bob', stack: 1000, isActive: true },
      { id: 'p3', name: 'Carol', stack: 1000, isActive: true }
    ];
    
    game.initializeGame(players, { small: 10, big: 20 });
    game.dealHoleCards();
    
    // Complete preflop betting
    game.processPlayerAction('p1', 'call', 0);
    game.processPlayerAction('p2', 'call', 0);
    game.processPlayerAction('p3', 'check', 0);
    
    const state = game.getState(true);
    console.log('Betting round completion debug:');
    state.players.forEach((p, i) => {
      console.log(`Player ${i}: ${p.name}, bet: ${p.bet}, hasActed: ${p.hasActed}, allIn: ${p.allIn}, folded: ${p.folded}`);
    });
    console.log('Current bet:', state.currentBet);
    console.log('Is betting round complete:', game.isBettingRoundComplete());
    
    this.assert(state.gamePhase === 'preflop', 'Still in preflop after betting');
    
    // Test betting round completion logic
    const isComplete = game.isBettingRoundComplete();
    this.assert(isComplete === true, 'Betting round is complete when all have acted');
  }

  // Run all tests
  runAllTests() {
    console.log('🚀 STARTING TEXAS HOLD\'EM RULES COMPLIANCE TEST SUITE');
    console.log('=' * 60);
    
    this.testDeckAndCards();
    this.testBlindsAndDealer();
    this.testBettingActions();
    this.testAllInAndSidePots();
    this.testFoldingAndPotAward();
    this.testCommunityCards();
    this.testHandEvaluation();
    this.testHeadsUp();
    this.testEdgeCases();
    this.testBettingRoundCompletion();
    
    this.printSummary();
  }
}

// Run the test suite
const testSuite = new PokerTestSuite();
testSuite.runAllTests(); 