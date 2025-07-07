const { PokerGame } = require('./PokerGame');

console.log('=== DEBUG: Card Dealing Test ===');

const game = new PokerGame();
const players = [
  { id: 'p1', name: 'Alice', stack: 1000, isActive: true },
  { id: 'p2', name: 'Bob', stack: 1000, isActive: true },
  { id: 'p3', name: 'Carol', stack: 1000, isActive: true }
];

console.log('Initializing game...');
game.initializeGame(players, { small: 10, big: 20 });

console.log('Before dealing cards:');
const state1 = game.getState();
state1.players.forEach((p, i) => {
  console.log(`Player ${i}: ${p.name}, cards: ${JSON.stringify(p.cards)}`);
});

console.log('\nDeck before dealing:');
console.log(game.deck.getState());

console.log('\nDealing hole cards...');
// Let's manually step through the dealing process
const activePlayers = game.players.filter(p => p.isActive);
console.log(`Active players: ${activePlayers.length}`);

for (let i = 0; i < 2; i++) {
  console.log(`\nDealing round ${i + 1}:`);
  for (const player of activePlayers) {
    const card = game.deck.dealCard();
    console.log(`Dealing to ${player.name}: ${JSON.stringify(card)}`);
    if (card) {
      player.cards.push(card);
      console.log(`${player.name} now has ${player.cards.length} cards: ${JSON.stringify(player.cards)}`);
    }
  }
}

console.log('\nAfter dealing cards:');
const state2 = game.getState();
state2.players.forEach((p, i) => {
  console.log(`Player ${i}: ${p.name}, cards: ${JSON.stringify(p.cards)}, cards.length: ${p.cards.length}`);
});

console.log('\nDeck after dealing:');
console.log(game.deck.getState()); 