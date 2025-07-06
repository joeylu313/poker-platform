# Poker Platform

A real-time Texas Hold'em poker platform built with React and Node.js.

## Features

- **Real-time multiplayer** Texas Hold'em poker
- **Private tables** with invite links
- **Guest play** (no registration required)
- **Host controls** (set blinds, kick players, etc.)
- **Play money** (players choose their stack size)
- **Max 8 players** per table
- **Simple, clean UI**

## Tech Stack

- **Frontend:** React (Vite)
- **Backend:** Node.js (Express)
- **Real-time:** Socket.IO
- **Containerization:** Docker

## Quick Start

### Development

1. Install dependencies:

   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   ```

2. Start development servers:

   ```bash
   npm run dev
   ```

3. Open http://localhost:5173 in your browser

### Docker

1. Build and run with Docker:

   ```bash
   npm run docker:build
   npm run docker:up
   ```

2. Open http://localhost:3000 in your browser

## Project Structure

```
poker-platform/
├── client/                 # React frontend
├── server/                 # Node.js backend
├── shared/                 # Shared types and utilities
├── docker/                 # Docker configuration
├── docker-compose.yml      # Docker Compose setup
└── README.md
```

## Game Rules

- Texas Hold'em poker
- Maximum 8 players per table
- Host sets blinds and table options
- Players choose their starting stack (play money)
- Private tables only (invite link required)

## Future Features

- Player statistics
- Hand histories
- Replays
- Spectator mode
- Chat functionality
- Tournament support

## License

MIT
