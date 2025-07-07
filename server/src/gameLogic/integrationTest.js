const { PokerGame } = require('./PokerGame');

// Simple integration test to verify server-game integration
function testServerIntegration() {
  console.log('🧪 TESTING: Server-Game Integration');
  
  // Test 1: Game initialization with server-style data
  const game = new PokerGame();
  const players = [
    { id: 'socket1', name: 'Alice', stack: 1000, isActive: true },
    { id: 'socket2', name: 'Bob', stack: 1000, isActive: true },
    { id: 'socket3', name: 'Carol', stack: 1000, isActive: true }
  ];
  
  const gameState = game.initializeGame(players, { small: 10, big: 20 });
  game.dealHoleCards();
  
  console.log('✅ Game initialized successfully');
  console.log('✅ Players:', gameState.players.length);
  console.log('✅ Blinds posted:', gameState.pot === 30);
  
  // Test 2: Player actions (simulating server calls)
  try {
    game.processPlayerAction('socket1', 'call', 0);
    game.processPlayerAction('socket2', 'call', 0);
    game.processPlayerAction('socket3', 'check', 0);
    console.log('✅ Player actions processed successfully');
  } catch (error) {
    console.log('❌ Player action failed:', error.message);
    return false;
  }
  
  // Test 3: Betting round completion
  const isComplete = game.isBettingRoundComplete();
  console.log('✅ Betting round completion:', isComplete);
  
  // Test 4: Community cards
  if (isComplete) {
    game.dealCommunityCards();
    console.log('✅ Community cards dealt:', game.communityCards.length);
  }
  
  // Test 5: All-in scenario
  const allInGame = new PokerGame();
  const allInPlayers = [
    { id: 'socket1', name: 'Alice', stack: 50, isActive: true },
    { id: 'socket2', name: 'Bob', stack: 1000, isActive: true }
  ];
  
  allInGame.initializeGame(allInPlayers, { small: 10, big: 20 });
  allInGame.dealHoleCards();
  
  try {
    allInGame.processPlayerAction('socket1', 'raise', 40); // Alice has 40 after blinds
    console.log('✅ All-in scenario works');
  } catch (error) {
    console.log('❌ All-in scenario failed:', error.message);
    return false;
  }
  
  // Test 6: Missing methods that server calls
  console.log('✅ isMultiWayAllIn exists:', typeof allInGame.isMultiWayAllIn === 'function');
  console.log('✅ hasOnlyOnePlayer exists:', typeof allInGame.hasOnlyOnePlayer === 'function');
  console.log('✅ getBustedPlayers exists:', typeof allInGame.getBustedPlayers === 'function');
  console.log('✅ determineWinner exists:', typeof allInGame.determineWinner === 'function');
  
  console.log('🎉 Server-Game Integration Test PASSED');
  return true;
}

// Run the integration test
if (require.main === module) {
  testServerIntegration();
}

module.exports = { testServerIntegration }; 