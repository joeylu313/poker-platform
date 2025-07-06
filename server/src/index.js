const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const PokerGame = require('./gameLogic');

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
  socket.on('startGame', (tableId) => {
    const table = tables.get(tableId);
    if (table && table.host === socket.id && table.players.length >= 2) {
      table.gameState = 'playing';
      
      // Initialize poker game
      const game = new PokerGame();
      const gameState = game.initializeGame(table.players, table.blinds);
      game.dealHoleCards();
      
      games.set(tableId, game);
      
      console.log('Game started for table:', tableId);
      console.log('Game state:', gameState);
      
      // Send personalized game state to all players
      table.players.forEach(player => {
        const playerView = game.getPlayerView(player.id);
        io.to(player.id).emit('gameStarted', playerView);
      });
    }
  });

  // Player action (bet, fold, call, raise)
  socket.on('playerAction', (data) => {
    const { tableId, action, amount } = data;
    const table = tables.get(tableId);
    const game = games.get(tableId);
    
    console.log('Player action:', { tableId, playerId: socket.id, action, amount });
    
    if (table && table.gameState === 'playing' && game) {
      // Handle player action
      const gameState = game.handlePlayerAction(socket.id, action, amount);
      
      if (gameState) {
        console.log('Updated game state:', gameState);
        
        // Check if only one player remains (automatic win)
        const activePlayers = gameState.players.filter(p => !p.folded);
        if (activePlayers.length === 1) {
          console.log('Only one player remaining, automatic win');
          const winner = activePlayers[0];
          winner.stack += gameState.pot;
          
          // Send automatic win result
          io.to(tableId).emit('automaticWin', {
            winner: winner,
            pot: gameState.pot
          });
          
          // Reset game for next hand
          setTimeout(() => {
            const newGameState = game.initializeGame(table.players, table.blinds);
            game.dealHoleCards();
            
            table.players.forEach(player => {
              const playerView = game.getPlayerView(player.id);
              io.to(player.id).emit('newHand', playerView);
            });
          }, 3000); // 3 second delay to show results
          
          return;
        }
        
        // Send personalized updated game state to all players
        table.players.forEach(player => {
          const playerView = game.getPlayerView(player.id);
          io.to(player.id).emit('gameUpdate', playerView);
        });
        
        // Check if betting round is complete
        if (game.isBettingRoundComplete()) {
          console.log('Betting round complete, dealing next cards');
          
          if (game.gamePhase === 'showdown') {
            // Handle showdown
            const result = game.determineWinner();
            console.log('Showdown result:', result);
            
            // Send showdown result to all players
            io.to(tableId).emit('showdown', {
              winner: result.winner,
              winningHand: result.winningHand,
              pot: result.pot
            });
            
            // Reset game for next hand
            setTimeout(() => {
              const newGameState = game.initializeGame(table.players, table.blinds);
              game.dealHoleCards();
              
              table.players.forEach(player => {
                const playerView = game.getPlayerView(player.id);
                io.to(player.id).emit('newHand', playerView);
              });
            }, 3000); // 3 second delay to show results
          } else {
            // Deal next community cards
            game.dealCommunityCards();
            
            // Send personalized game state to all players
            table.players.forEach(player => {
              const playerView = game.getPlayerView(player.id);
              io.to(player.id).emit('bettingRoundComplete', playerView);
            });
          }
        }
      }
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
    
    // Remove player from all tables they're in
    for (const [tableId, table] of tables.entries()) {
      const playerIndex = table.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        const player = table.players.splice(playerIndex, 1)[0];
        io.to(tableId).emit('playerLeft', player);
        io.to(tableId).emit('tableUpdate', table);
        
        // If no players left, remove table
        if (table.players.length === 0) {
          tables.delete(tableId);
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