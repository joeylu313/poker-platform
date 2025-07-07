const { PokerGame } = require('./PokerGame');

console.log('=== DEBUG: All-In Scenario ===');

const game = new PokerGame();
const players = [
  { id: 'p1', name: 'Alice', stack: 100, isActive: true },
  { id: 'p2', name: 'Bob', stack: 200, isActive: true },
  { id: 'p3', name: 'Carol', stack: 300, isActive: true }
];

console.log('Initializing game...');
game.initializeGame(players, { small: 10, big: 20 });
game.dealHoleCards();

console.log('Before Alice all-in:');
let state = game.getState(true);
state.players.forEach((p, i) => {
  console.log(`Player ${i}: ${p.name}, stack: ${p.stack}, bet: ${p.bet}, allIn: ${p.allIn}`);
});

console.log('\nAlice goes all-in...');
game.processPlayerAction('p1', 'raise', 100);

console.log('After Alice all-in:');
state = game.getState(true);
state.players.forEach((p, i) => {
  console.log(`Player ${i}: ${p.name}, stack: ${p.stack}, bet: ${p.bet}, allIn: ${p.allIn}`);
});

console.log('\nBob calls...');
game.processPlayerAction('p2', 'call', 80);

console.log('After Bob calls:');
state = game.getState(true);
state.players.forEach((p, i) => {
  console.log(`Player ${i}: ${p.name}, stack: ${p.stack}, bet: ${p.bet}, allIn: ${p.allIn}`);
});

console.log('\nCarol calls...');
game.processPlayerAction('p3', 'call', 80);

console.log('After Carol calls:');
state = game.getState(true);
state.players.forEach((p, i) => {
  console.log(`Player ${i}: ${p.name}, stack: ${p.stack}, bet: ${p.bet}, allIn: ${p.allIn}`);
});

console.log('\nPot:', state.pot); 