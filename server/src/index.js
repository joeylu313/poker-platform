const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { PokerGame } = require('./gameLogic');

const app = express();
const server = http.createServer(app);

// Generate a short 5-character ID
function generateShortId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? "https://your-domain.com" 
      : ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Store active tables
const tables = new Map();
// Store active games
const games = new Map();
// Store last action times for rate limiting
const lastActionTimes = new Map();

// Cleanup old tables (run every 30 minutes)
setInterval(() => {
  const now = Date.now();
  const thirtyMinutesAgo = now - (30 * 60 * 1000);
  
  for (const [tableId, table] of tables.entries()) {
    if (table.createdAt && table.createdAt.getTime() < thirtyMinutesAgo && table.players.length === 0) {
      console.log(`Removing old inactive table: ${tableId}`);
      tables.delete(tableId);
      games.delete(tableId);
    }
  }
}, 30 * 60 * 1000); // 30 minutes

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  console.log('Active tables:', tables.size);

  // Create a new table
  socket.on('createTable', (data) => {
    console.log('Create table request:', data);
    const tableId = generateShortId();
    const table = {
      id: tableId,
      host: socket.id,
      players: [],
      maxPlayers: 8,
      blinds: data.blinds || { small: 10, big: 20 },
      gameState: 'waiting', // waiting, playing, finished
      inviteLink: `${process.env.CLIENT_URL || 'http://localhost:3000'}/table/${tableId}`,
      createdAt: new Date()
    };
    
    console.log('Creating table:', table);
    tables.set(tableId, table);
    socket.join(tableId);
    socket.emit('tableCreated', table);
    console.log('Table created and response sent');
  });

  // Join a table
  socket.on('joinTable', (data) => {
    console.log('Join table request:', data);
    const { tableId, playerName, stackSize } = data;
    
    // Extract table ID from full URL if needed
    let actualTableId = tableId;
    if (tableId.includes('/table/')) {
      actualTableId = tableId.split('/table/')[1];
    }
    
    const table = tables.get(actualTableId);
    
    console.log('Looking for table:', actualTableId);
    console.log('Table found:', !!table);
    console.log('Available tables:', Array.from(tables.keys()));
    
    if (!table) {
      console.log('Table not found, sending error');
      socket.emit('error', { message: 'Table not found' });
      return;
    }
    
    if (table.players.length >= table.maxPlayers) {
      socket.emit('error', { message: 'Table is full' });
      return;
    }
    
    const player = {
      id: socket.id,
      name: playerName,
      stack: stackSize,
      isHost: table.host === socket.id,
      isActive: true
    };
    
    table.players.push(player);
    socket.join(actualTableId);
    
    // Notify all players in the table
    console.log('Player joined successfully, emitting updates');
    io.to(actualTableId).emit('playerJoined', player);
    io.to(actualTableId).emit('tableUpdate', table);
    console.log('Table state after join:', table);
  });

  // Start game
  socket.on('startGame', (data) => {
    const { tableId } = data;
    const table = tables.get(tableId);
    
    console.log('Start game request:', { tableId, playerId: socket.id });
    
    if (!tableId) {
      socket.emit('error', { message: 'Invalid table ID' });
      return;
    }
    
    if (!table) {
      socket.emit('error', { message: 'Table not found' });
      return;
    }
    
    if (table.host !== socket.id) {
      socket.emit('error', { message: 'Only the host can start the game' });
      return;
    }
    
    if (table.gameState !== 'waiting') {
      socket.emit('error', { message: 'Game is already in progress' });
      return;
    }
    
    // Check if there are enough players to start
    if (table.players.length < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start the game' });
      return;
    }
    
    // Check if there are enough players to start
    if (table.players.length < 2) {
      socket.emit('error', { message: 'Need at least 2 players to start the game' });
      return;
    }
    
    console.log('Starting game for table:', tableId);
    table.gameState = 'playing';
    
    // Get or create game instance
    let game = games.get(tableId);
    const activePlayers = table.players.filter(p => p.isActive !== false);
    
    if (!game) {
      // First game - create new instance and initialize
      game = new PokerGame();
      const gameState = game.initializeGame(activePlayers, table.blinds);
      games.set(tableId, game);
    } else {
      // Subsequent games - reset existing instance and update players
      game.players = activePlayers.map(player => ({
        ...player,
        bet: 0,
        folded: false,
        allIn: false,
        hasActed: false,
        cards: []
      }));
      game.resetForNewHand();
      game._postBlinds(table.blinds);
    }
    
    // Deal cards
    game.dealHoleCards();
    
    console.log('=== GAME START DEBUG ===');
    console.log('Game state after dealing cards:', game.getState());
    console.log('Players with cards:', game.players.map(p => ({ id: p.id, name: p.name, cards: p.cards })));
    
    // Send initial game state to all players
    table.players.forEach(player => {
      const playerView = game.getPlayerView(player.id);
      const gameState = game.getState();
      // Replace the player's data with their personal view (including their cards)
      const personalizedGameState = {
        ...gameState,
        players: gameState.players.map(p => 
          p.id === player.id ? playerView : p
        )
      };
      console.log(`Sending gameStarted to player ${player.id} (${player.name}):`, personalizedGameState);
      io.to(player.id).emit('gameStarted', personalizedGameState);
    });
    
    console.log('Game started for table:', tableId);
    console.log('Game state:', game.getState());
    
    // Emit table update
    io.to(tableId).emit('tableUpdate', table);
  });

  // Player action (bet, fold, call, raise)
  socket.on('playerAction', (data) => {
    const { tableId, action, amount } = data;
    const table = tables.get(tableId);
    const game = games.get(tableId);
    
    console.log('Player action:', { tableId, playerId: socket.id, action, amount });
    
    // Rate limiting: prevent actions more than once per second
    const now = Date.now();
    const lastActionTime = lastActionTimes.get(socket.id) || 0;
    if (now - lastActionTime < 1000) {
      socket.emit('error', { message: 'Please wait before making another action' });
      return;
    }
    lastActionTimes.set(socket.id, now);
    
    if (!tableId) {
      socket.emit('error', { message: 'Invalid table ID' });
      return;
    }
    
    if (!table) {
      socket.emit('error', { message: 'Table not found' });
      return;
    }
    
    if (!game) {
      socket.emit('error', { message: 'Game not found' });
      return;
    }
    
    if (table.gameState !== 'playing') {
      socket.emit('error', { message: 'Game is not in progress' });
      return;
    }
    
    // Handle player action
    try {
      game.processPlayerAction(socket.id, action, amount);
    } catch (err) {
      socket.emit('error', { message: err.message || 'Invalid action or not your turn' });
      return;
    }
    const gameState = game.getState();
    
    if (gameState) {
      console.log('Updated game state:', gameState);
      
      // Check if only one player remains (automatic win)
      const activePlayers = gameState.players.filter(p => !p.folded);
      if (activePlayers.length === 1) {
        console.log('Only one player left, automatic win');
        const result = game.determineWinner();
        // Send personalized game state to all players
        table.players.forEach(player => {
          const playerView = game.getPlayerView(player.id);
          const personalizedGameState = {
            ...gameState,
            players: gameState.players.map(p => 
              p.id === player.id ? playerView : p
            )
          };
          io.to(player.id).emit('gameUpdate', { gameState: personalizedGameState, result });
        });
        return;
      }
      
      // Check if we have insufficient players to continue
      if (game.hasInsufficientPlayers()) {
        console.log('Insufficient players to continue - ending game');
        io.to(tableId).emit('gameEnd', {
          message: 'Game ended due to insufficient players'
        });
        return;
      }
      
      // Check if there's only one active player (not enough players to continue)
      const remainingActivePlayers = gameState.players.filter(p => !p.folded && p.isActive);
      if (remainingActivePlayers.length === 1) {
        console.log('Only one active player remaining - game cannot continue');
        io.to(tableId).emit('insufficientPlayers', { 
          message: 'More players required to continue the game',
          remainingPlayer: remainingActivePlayers[0]
        });
        return;
      }
      
      // Send personalized updated game state to all players
      table.players.forEach(player => {
        const playerView = game.getPlayerView(player.id);
        const gameState = game.getState();
        // Replace the player's data with their personal view (including their cards)
        const personalizedGameState = {
          ...gameState,
          players: gameState.players.map(p => 
            p.id === player.id ? playerView : p
          )
        };
        io.to(player.id).emit('gameUpdate', personalizedGameState);
      });
      
      // Check if betting round is complete
      if (game.isBettingRoundComplete()) {
        console.log('Betting round complete, dealing next cards');
        
        // Check if all players are all-in or we have a multi-way all-in - if so, deal all remaining cards automatically
        if (game.areAllPlayersAllIn() || game.isMultiWayAllIn()) {
          console.log('All players all-in or multi-way all-in - dealing all remaining cards automatically');
          
          // Deal flop first
          if (game.communityCards.length === 0) {
            game.dealCommunityCards(); // Deal flop
            console.log('Dealt flop for all-in situation');
            
            // Send flop to all players
            table.players.forEach(player => {
              const playerView = game.getPlayerView(player.id);
              const gameState = game.getState();
              // Replace the player's data with their personal view (including their cards)
              const personalizedGameState = {
                ...gameState,
                players: gameState.players.map(p => 
                  p.id === player.id ? playerView : p
                )
              };
              io.to(player.id).emit('gameStateUpdate', personalizedGameState);
            });
            
            // Deal turn after 2 seconds
            setTimeout(() => {
              if (game.communityCards.length === 3) {
                game.dealCommunityCards(); // Deal turn
                console.log('Dealt turn for all-in situation');
                
                // Send turn to all players
                table.players.forEach(player => {
                  const playerView = game.getPlayerView(player.id);
                  const gameState = game.getState();
                  // Replace the player's data with their personal view (including their cards)
                  const personalizedGameState = {
                    ...gameState,
                    players: gameState.players.map(p => 
                      p.id === player.id ? playerView : p
                    )
                  };
                  io.to(player.id).emit('gameStateUpdate', personalizedGameState);
                });
                
                // Deal river after 2 more seconds
                setTimeout(() => {
                  if (game.communityCards.length === 4) {
                    game.dealCommunityCards(); // Deal river
                    console.log('Dealt river for all-in situation');
                    
                    // Send complete game state with all 5 community cards to all players
                    table.players.forEach(player => {
                      const playerView = game.getPlayerView(player.id);
                      const gameState = game.getState();
                      // Replace the player's data with their personal view (including their cards)
                      const personalizedGameState = {
                        ...gameState,
                        players: gameState.players.map(p => 
                          p.id === player.id ? playerView : p
                        )
                      };
                      io.to(player.id).emit('gameStateUpdate', personalizedGameState);
                    });
                    
                    // Handle showdown after a brief delay to ensure frontend receives the complete state
                    setTimeout(() => {
                      // Check if we're still in an all-in showdown situation
                      if (game.isAllInShowdown()) {
                        const result = game.determineWinner();
                        console.log('All-in showdown result:', result);
                        
                        // Send showdown result to all players
                        io.to(tableId).emit('showdown', {
                          winner: result.winner,
                          winningHand: result.winningHand,
                          pot: result.pot,
                          sidePots: result.sidePots || null
                        });
                        
                        // Update table player data with game state
                        game.players.forEach(gamePlayer => {
                          const tablePlayer = table.players.find(p => p.id === gamePlayer.id);
                          if (tablePlayer) {
                            tablePlayer.stack = gamePlayer.stack;
                            tablePlayer.isActive = gamePlayer.isActive;
                          }
                        });
                        
                        // Check for busted players after showdown (only players with stack <= 0)
                        const bustedPlayers = game.players.filter(p => p.stack <= 0 && p.isActive);
                        bustedPlayers.forEach(bustedPlayer => {
                          const playerIndex = table.players.findIndex(p => p.id === bustedPlayer.id);
                          if (playerIndex !== -1) {
                            const tablePlayer = table.players[playerIndex];
                            // Remove busted player from table completely
                            table.players.splice(playerIndex, 1);
                            console.log(`Player ${tablePlayer.name} busted out and has been removed from the table`);
                            io.to(bustedPlayer.id).emit('bustedOut', { 
                              message: 'You have busted out! You have been removed from the table.' 
                            });
                            io.to(tableId).emit('playerBusted', tablePlayer);
                            io.to(tableId).emit('tableUpdate', table);
                          }
                        });
                        
                        // Emit table update after handling busted players
                        io.to(tableId).emit('tableUpdate', table);
                        
                        // Check if we have enough players to continue
                        if (table.players.length >= 2) {
                          // Reset game for next hand
                          setTimeout(() => {
                            const activePlayers = table.players.filter(p => p.isActive !== false);
                            // Update players and reset for new hand
                            game.players = activePlayers.map(player => ({
                              ...player,
                              bet: 0,
                              folded: false,
                              allIn: false,
                              hasActed: false,
                              cards: []
                            }));
                            game.resetForNewHand();
                            game._postBlinds(table.blinds);
                            game.dealHoleCards();
                            
                            table.players.forEach(player => {
                              const playerView = game.getPlayerView(player.id);
                              const gameState = game.getState();
                              // Replace the player's data with their personal view (including their cards)
                              const personalizedGameState = {
                                ...gameState,
                                players: gameState.players.map(p => 
                                  p.id === player.id ? playerView : p
                                )
                              };
                              io.to(player.id).emit('newHand', personalizedGameState);
                            });
                          }, 3000); // 3 second delay to show results
                        } else {
                          // Not enough players to continue - reset table to waiting state
                          console.log('Not enough players to continue the game');
                          table.gameState = 'waiting';
                          games.delete(tableId);
                          io.to(tableId).emit('insufficientPlayers', { 
                            message: 'Not enough players to continue the game',
                            remainingPlayers: table.players
                          });
                          io.to(tableId).emit('tableUpdate', table);
                        }
                      }
                    }, 500); // Brief delay to ensure frontend receives complete state
                  }
                }, 2000); // 2 second delay for turn
              }
            }, 2000); // 2 second delay for flop
          }
        } else {
          // Normal betting round completion - deal next community cards
          const nextState = game.dealCommunityCards();
          
          if (game.gamePhase === 'showdown') {
            // Handle showdown
            const result = game.determineWinner();
            console.log('Showdown result:', result);
            
            // Send showdown result to all players
            io.to(tableId).emit('showdown', {
              winner: result.winner,
              winningHand: result.winningHand,
              pot: result.pot,
              sidePots: result.sidePots || null
            });
            
            // Update table player data with game state
            game.players.forEach(gamePlayer => {
              const tablePlayer = table.players.find(p => p.id === gamePlayer.id);
              if (tablePlayer) {
                tablePlayer.stack = gamePlayer.stack;
                tablePlayer.isActive = gamePlayer.isActive;
              }
            });
            
            // Check for busted players after showdown (only players with stack <= 0)
            const bustedPlayers = game.players.filter(p => p.stack <= 0 && p.isActive);
            bustedPlayers.forEach(bustedPlayer => {
              const playerIndex = table.players.findIndex(p => p.id === bustedPlayer.id);
              if (playerIndex !== -1) {
                const tablePlayer = table.players[playerIndex];
                // Remove busted player from table completely
                table.players.splice(playerIndex, 1);
                console.log(`Player ${tablePlayer.name} busted out and has been removed from the table`);
                io.to(bustedPlayer.id).emit('bustedOut', { 
                  message: 'You have busted out! You have been removed from the table.' 
                });
                io.to(tableId).emit('playerBusted', tablePlayer);
                io.to(tableId).emit('tableUpdate', table);
              }
            });
            
            // Emit table update after handling busted players
            io.to(tableId).emit('tableUpdate', table);
            
            // Check if we have enough players to continue
            if (table.players.length >= 2) {
              // Reset game for next hand
              setTimeout(() => {
                const activePlayers = table.players.filter(p => p.isActive !== false);
                // Update players and reset for new hand
                game.players = activePlayers.map(player => ({
                  ...player,
                  bet: 0,
                  folded: false,
                  allIn: false,
                  hasActed: false,
                  cards: []
                }));
                game.resetForNewHand();
                game._postBlinds(table.blinds);
                game.dealHoleCards();
                
                table.players.forEach(player => {
                  const playerView = game.getPlayerView(player.id);
                  const gameState = game.getState();
                  // Replace the player's data with their personal view (including their cards)
                  const personalizedGameState = {
                    ...gameState,
                    players: gameState.players.map(p => 
                      p.id === player.id ? playerView : p
                    )
                  };
                  io.to(player.id).emit('newHand', personalizedGameState);
                });
              }, 3000); // 3 second delay to show results
            } else {
              // Not enough players to continue - reset table to waiting state
              console.log('Not enough players to continue the game');
              table.gameState = 'waiting';
              games.delete(tableId);
              io.to(tableId).emit('insufficientPlayers', { 
                message: 'Not enough players to continue the game',
                remainingPlayers: table.players
              });
              io.to(tableId).emit('tableUpdate', table);
            }
          } else {
            // Reset player action flags for the new betting round
            game.players.forEach(player => {
              player.hasActed = false;
            });
            
            // Reset current bet for the new betting round
            game.currentBet = 0;
            
            // Reset all player bets for the new betting round
            game.players.forEach(player => {
              player.bet = 0;
            });
            
            // Set the first player to act in the new betting round
            const activePlayers = game.players.filter(p => !p.folded && p.isActive);
            if (activePlayers.length >= 2) {
              // In postflop rounds, action starts with the first active player left of the dealer (SB), dealer acts last
              let firstToAct = (game.dealer + 1) % game.players.length;
              let count = 0;
              while ((game.players[firstToAct].folded || !game.players[firstToAct].isActive) && count < game.players.length) {
                firstToAct = (firstToAct + 1) % game.players.length;
                count++;
              }
              game.currentPlayer = firstToAct;
            }
            
            // Send personalized game state to all players
            table.players.forEach(player => {
              const playerView = game.getPlayerView(player.id);
              const gameState = game.getState();
              // Replace the player's data with their personal view (including their cards)
              const personalizedGameState = {
                ...gameState,
                players: gameState.players.map(p => 
                  p.id === player.id ? playerView : p
                )
              };
              io.to(player.id).emit('bettingRoundComplete', personalizedGameState);
            });
          }
        }
      }
    } else {
      socket.emit('error', { message: 'Invalid action or not your turn' });
    }
  });

  // Kick player (host only)
  socket.on('kickPlayer', (data) => {
    const { tableId, playerId } = data;
    const table = tables.get(tableId);
    
    if (table && table.host === socket.id) {
      const playerIndex = table.players.findIndex(p => p.id === playerId);
      if (playerIndex !== -1) {
        const kickedPlayer = table.players.splice(playerIndex, 1)[0];
        io.to(playerId).emit('kicked', { message: 'You have been kicked from the table' });
        io.to(tableId).emit('playerKicked', kickedPlayer);
        io.to(tableId).emit('tableUpdate', table);
      }
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Clean up rate limiting data
    lastActionTimes.delete(socket.id);
    
    // Remove player from all tables they're in
    for (const [tableId, table] of tables.entries()) {
      const playerIndex = table.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const player = table.players.splice(playerIndex, 1)[0];
        io.to(tableId).emit('playerLeft', player);
        io.to(tableId).emit('tableUpdate', table);
        
        // If no players left, remove table and game
        if (table.players.length === 0) {
          tables.delete(tableId);
          games.delete(tableId);
          console.log(`Table ${tableId} removed - no players left`);
        } else if (table.gameState === 'playing') {
          // If game is in progress, check if we need to end it
          const game = games.get(tableId);
          if (game && game.hasOnlyOnePlayer()) {
            console.log(`Game ending for table ${tableId} - insufficient players`);
            io.to(tableId).emit('insufficientPlayers', { 
              message: 'Game ended - insufficient players to continue',
              remainingPlayer: table.players[0]
            });
            // Reset table to waiting state
            table.gameState = 'waiting';
            games.delete(tableId);
            io.to(tableId).emit('tableUpdate', table);
          }
        }
      }
    }
  });
});

// API Routes
app.get('/api/tables/:tableId', (req, res) => {
  const table = tables.get(req.params.tableId);
  if (table) {
    res.json(table);
  } else {
    res.status(404).json({ error: 'Table not found' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', tables: tables.size });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 