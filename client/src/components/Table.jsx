import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { socket } from '../socket'

function Table() {
  const { tableId } = useParams()
  const navigate = useNavigate()
  const [table, setTable] = useState(null)
  const [gameState, setGameState] = useState(null)
  const [currentPlayer, setCurrentPlayer] = useState(null)
  const [error, setError] = useState(null)
  const [showInviteLink, setShowInviteLink] = useState(false)
  const [showdownResult, setShowdownResult] = useState(null)
  const [automaticWinResult, setAutomaticWinResult] = useState(null)
  const [showBettingInterface, setShowBettingInterface] = useState(false)
  const [raiseAmount, setRaiseAmount] = useState(50)
  const [customRaiseAmount, setCustomRaiseAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Update raise amount when game state changes
  useEffect(() => {
    if (gameState && gameState.players) {
      const currentPlayer = gameState.players.find(p => p.id === socket.id)
      if (currentPlayer) {
        // Calculate minimum raise based on game state
        const currentBet = gameState.currentBet || 0
        const bigBlind = table?.blinds?.big || 20
        const minRaise = currentBet + bigBlind
        setRaiseAmount(Math.max(minRaise, 50))
      }
    }
  }, [gameState, table])

  useEffect(() => {
    console.log('Table component mounted, tableId:', tableId)
    console.log('Socket connected:', socket.connected)

    const fetchTableData = async () => {
      try {
        const response = await fetch(`http://localhost:5001/api/tables/${tableId}`)
        if (response.ok) {
          const tableData = await response.json()
          setTable(tableData)
          console.log('Table data fetched:', tableData)
        } else {
          setError('Table not found')
        }
      } catch (err) {
        console.error('Error fetching table:', err)
        setError('Failed to load table')
      }
    }

    if (socket.connected) {
      fetchTableData()
    }

    socket.on('tableUpdate', (updatedTable) => {
      console.log('Table updated:', updatedTable)
      setTable(updatedTable)
    })

    socket.on('gameStarted', (gameData) => {
      console.log('Game started:', gameData)
      setGameState(gameData)
    })

    socket.on('gameUpdate', (gameData) => {
      console.log('Game updated:', gameData)
      setGameState(gameData)
    })

    socket.on('gameStateUpdate', (gameData) => {
      console.log('Game state update received:', gameData)
      setGameState(gameData)
    })

    socket.on('bettingRoundComplete', (gameData) => {
      console.log('Betting round complete:', gameData)
      setGameState(gameData)
    })

    socket.on('showdown', (result) => {
      console.log('Showdown result:', result)
      setShowdownResult(result)
    })

    socket.on('automaticWin', (result) => {
      console.log('Automatic win result:', result)
      setAutomaticWinResult(result)
    })

    socket.on('newHand', (gameData) => {
      console.log('New hand started:', gameData)
      setGameState(gameData)
      setShowdownResult(null)
      setAutomaticWinResult(null)
    })

    socket.on('playerJoined', (player) => {
      console.log('Player joined:', player)
    })

    socket.on('playerLeft', (player) => {
      console.log('Player left:', player)
    })

    socket.on('playerKicked', (player) => {
      console.log('Player kicked:', player)
    })

    socket.on('playerBusted', (player) => {
      console.log('Player busted:', player)
    })

    socket.on('bustedOut', (data) => {
      console.log('You busted out:', data)
      alert(data.message)
      // Don't navigate away - they become a spectator
    })

    socket.on('insufficientPlayers', (data) => {
      console.log('Insufficient players:', data)
      alert(data.message)
      // Clear game state so the Start Game button becomes available
      setGameState(null)
      setShowdownResult(null)
      setAutomaticWinResult(null)
    })

    socket.on('kicked', (data) => {
      console.log('You were kicked:', data)
      alert(data.message)
      navigate('/')
    })

    socket.on('error', (data) => {
      console.log('Error:', data)
      setError(data.message)
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000)
    })

    return () => {
      console.log('Cleaning up Table component event listeners')
      socket.off('tableUpdate')
      socket.off('gameStarted')
      socket.off('gameUpdate')
      socket.off('gameStateUpdate')
      socket.off('bettingRoundComplete')
      socket.off('showdown')
      socket.off('automaticWin')
      socket.off('newHand')
      socket.off('playerJoined')
      socket.off('playerLeft')
      socket.off('playerKicked')
      socket.off('playerBusted')
      socket.off('bustedOut')
      socket.off('insufficientPlayers')
      socket.off('kicked')
      socket.off('error')
    }
  }, [navigate])

  const handleStartGame = () => {
    if (table && table.players.length >= 2) {
      setIsLoading(true);
      socket.emit('startGame', { tableId })
      // Clear loading after a short delay
      setTimeout(() => setIsLoading(false), 2000);
    }
  }

  const handleKickPlayer = (playerId) => {
    socket.emit('kickPlayer', { tableId, playerId })
  }

  const handlePlayerAction = (action, amount = 0) => {
    console.log('Sending player action:', { tableId, action, amount });
    setIsLoading(true);
    socket.emit('playerAction', { tableId, action, amount })
    setShowBettingInterface(false)
    // Clear loading after a short delay
    setTimeout(() => setIsLoading(false), 1000);
  }

  const handleRaise = (amount) => {
    handlePlayerAction('raise', amount)
  }

  const handleBettingPreset = (type) => {
    if (!gameState || !gameState.players) return
    
    const currentPlayer = gameState.players.find(p => p.id === socket.id)
    if (!currentPlayer) return
    
    let amount = 0
    const currentBet = gameState.currentBet || 0
    const playerBet = currentPlayer.bet || 0
    const callAmount = currentBet - playerBet
    const bigBlind = table?.blinds?.big || 20
    
    switch (type) {
      case 'min':
        // Minimum raise (current bet + 1 big blind)
        amount = currentBet + bigBlind
        break
      case 'pot':
        // Pot-sized bet
        amount = gameState.pot || 0
        break
      case 'allin':
        // All-in
        amount = currentPlayer.stack
        break
      default:
        amount = raiseAmount
    }
    
    handleRaise(amount)
  }

  const handleCustomRaise = () => {
    const amount = parseInt(customRaiseAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount')
      return
    }
    handleRaise(amount)
    setCustomRaiseAmount('')
  }

  const copyInviteLink = () => {
    if (table) {
      navigator.clipboard.writeText(table.inviteLink)
      alert('Invite link copied to clipboard!')
    }
  }

  // Helper function to get suit symbol
  const getSuitSymbol = (suit) => {
    const suitSymbols = {
      'hearts': '♥',
      'diamonds': '♦',
      'clubs': '♣',
      'spades': '♠'
    }
    return suitSymbols[suit] || suit
  }

  // Helper function to get card display
  const getCardDisplay = (card) => {
    const suitSymbol = getSuitSymbol(card.suit)
    const isRed = card.suit === 'hearts' || card.suit === 'diamonds'
    return { symbol: suitSymbol, isRed }
  }

  // Helper function to check if player should see cards
  const shouldShowCards = (player) => {
    return player.id === socket.id && player.cards && player.cards.length > 0
  }

  // Helper function to convert rank to number
  const rankToNumber = (rank) => {
    const rankMap = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
      '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    }
    return rankMap[rank]
  }

  // Helper function to check if ranks form a straight
  const isStraight = (ranks) => {
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => a - b)
    if (uniqueRanks.length < 5) return false
    
    // Check for regular straight
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
      if (uniqueRanks[i + 4] - uniqueRanks[i] === 4) {
        return true
      }
    }
    
    // Check for A-2-3-4-5 straight (wheel)
    if (uniqueRanks.includes(14) && uniqueRanks.includes(2)) {
      const lowRanks = uniqueRanks.filter(r => r <= 5)
      if (lowRanks.length >= 4 && lowRanks.includes(2) && lowRanks.includes(3) && 
          lowRanks.includes(4) && lowRanks.includes(5)) {
        return true
      }
    }
    
    return false
  }

  // Helper function to evaluate a 5-card hand
  const evaluateFiveCardHand = (cards) => {
    const ranks = cards.map(card => rankToNumber(card.rank)).sort((a, b) => b - a)
    const suits = cards.map(card => card.suit)
    const rankCounts = {}
    
    ranks.forEach(rank => {
      rankCounts[rank] = (rankCounts[rank] || 0) + 1
    })
    
    const isFlush = suits.every(suit => suit === suits[0])
    const isStraightResult = isStraight(ranks)
    
    // Check for straight flush
    if (isFlush && isStraightResult) {
      return { rank: 8, name: 'Straight Flush', kickers: ranks }
    }
    
    // Check for four of a kind
    const fourRank = Object.keys(rankCounts).find(rank => rankCounts[rank] === 4)
    if (fourRank) {
      const kicker = ranks.find(rank => rank !== parseInt(fourRank))
      return { rank: 7, name: 'Four of a Kind', kickers: [parseInt(fourRank), kicker] }
    }
    
    // Check for full house
    const threeRank = Object.keys(rankCounts).find(rank => rankCounts[rank] === 3)
    const twoRank = Object.keys(rankCounts).find(rank => rankCounts[rank] === 2)
    if (threeRank && twoRank) {
      return { rank: 6, name: 'Full House', kickers: [parseInt(threeRank), parseInt(twoRank)] }
    }
    
    // Check for flush
    if (isFlush) {
      return { rank: 5, name: 'Flush', kickers: ranks }
    }
    
    // Check for straight
    if (isStraightResult) {
      return { rank: 4, name: 'Straight', kickers: ranks }
    }
    
    // Check for three of a kind
    if (threeRank) {
      const kickers = ranks.filter(rank => rank !== parseInt(threeRank))
      return { rank: 3, name: 'Three of a Kind', kickers: [parseInt(threeRank), ...kickers] }
    }
    
    // Check for two pair
    const pairs = Object.keys(rankCounts).filter(rank => rankCounts[rank] === 2).map(Number).sort((a, b) => b - a)
    if (pairs.length === 2) {
      const kicker = ranks.find(rank => !pairs.includes(rank))
      return { rank: 2, name: 'Two Pair', kickers: [...pairs, kicker] }
    }
    
    // Check for one pair
    if (pairs.length === 1) {
      const kickers = ranks.filter(rank => rank !== pairs[0])
      return { rank: 1, name: 'One Pair', kickers: [pairs[0], ...kickers] }
    }
    
    // High card
    return { rank: 0, name: 'High Card', kickers: ranks }
  }

  // Helper function to get all combinations of n cards from array
  const getCombinations = (cards, n) => {
    if (n === 0) return [[]]
    if (cards.length === 0) return []
    
    const [first, ...rest] = cards
    const withoutFirst = getCombinations(rest, n)
    const withFirst = getCombinations(rest, n - 1).map(combo => [first, ...combo])
    
    return [...withoutFirst, ...withFirst]
  }

  // Helper function to evaluate poker hand
  const evaluateHand = (holeCards, communityCards) => {
    if (!holeCards || holeCards.length === 0 || !communityCards || communityCards.length === 0) {
      return { rank: -1, name: 'No Cards', kickers: [] }
    }
    
    const allCards = [...holeCards, ...communityCards]
    const combinations = getCombinations(allCards, 5)
    
    let bestHand = { rank: 0, name: 'High Card', kickers: [] }
    
    for (const combo of combinations) {
      const hand = evaluateFiveCardHand(combo)
      if (hand.rank > bestHand.rank) {
        bestHand = hand
      }
    }
    
    return bestHand
  }

  // Helper function to get current player's hand
  const getCurrentPlayerHand = () => {
    if (!gameState || !gameState.players) return null
    
    const currentPlayer = gameState.players.find(p => p.id === socket.id)
    if (!currentPlayer || !currentPlayer.cards || currentPlayer.cards.length === 0) return null
    
    return evaluateHand(currentPlayer.cards, gameState.communityCards || [])
  }

  // Helper function to get minimum raise amount
  const getMinRaiseAmount = () => {
    if (!gameState) return 0
    
    const currentBet = gameState.currentBet || 0
    const bigBlind = table?.blinds?.big || 20
    
    // If no previous raise, minimum is current bet + big blind
    // If there was a previous raise, minimum is current bet + size of previous raise
    return currentBet + bigBlind
  }

  if (!table) {
    console.log('Table is null, showing loading state');
    return (
      <div className="container">
        <div className="card">
          <h2>Loading table...</h2>
          <p>Table ID: {tableId}</p>
          <p>Socket connected: {socket.connected ? 'Yes' : 'No'}</p>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      </div>
    )
  }



  return (
    <div className="container">
      <div className="header">
        <h1>Poker Table</h1>
        <p>Table ID: {tableId}</p>
        {table.host === socket.id && (
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowInviteLink(!showInviteLink)}
          >
            {showInviteLink ? 'Hide' : 'Show'} Invite Link
          </button>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {isLoading && (
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Processing...</p>
        </div>
      )}

      {showInviteLink && (
        <div className="card">
          <h3>Invite Link</h3>
          <p><strong>Table ID:</strong> {table.id}</p>
          <p><strong>Full Link:</strong> {table.inviteLink}</p>
          <button className="btn" onClick={copyInviteLink}>
            Copy Link
          </button>
        </div>
      )}

      <div className="poker-table-container">
        <div className="pot">
          Pot: ${gameState ? gameState.pot : 0}
        </div>

        <div className="community-cards">
          {gameState && gameState.communityCards && gameState.communityCards.map((card, index) => {
            const cardDisplay = getCardDisplay(card)
            return (
              <div key={index} className={`playing-card ${cardDisplay.isRed ? 'red' : ''}`}>
                <div className="card-rank">{card.rank}</div>
                <div className="card-suit">{cardDisplay.symbol}</div>
              </div>
            )
          })}
        </div>

        {(gameState ? (gameState.players || []) : (table.players || [])).map((player, index) => {
          const isCurrentPlayer = player.id === socket.id
          const isHost = player.isHost || player.id === table.host
          const isCurrentTurn = gameState && gameState.currentPlayer === index
          const isDealer = gameState && gameState.dealer === index
          const isSpectator = player.isActive === false

          return (
            <div
              key={player.id}
              className={`player-seat ${isCurrentPlayer ? 'active' : ''} ${isHost ? 'dealer' : ''} ${isCurrentTurn ? 'current-turn' : ''} ${isSpectator ? 'spectator' : ''}`}
            >
              <div>{player.name}</div>
              <div>${player.stack}</div>
              {player.bet > 0 && <div style={{ fontSize: '12px', color: '#FFD700' }}>Bet: ${player.bet}</div>}
              {player.folded && <div style={{ fontSize: '12px', color: '#f44336' }}>FOLDED</div>}
              {player.allIn && <div style={{ fontSize: '12px', color: '#FF6B6B' }}>ALL IN</div>}
              {isSpectator && <div style={{ fontSize: '12px', color: '#9E9E9E' }}>SPECTATOR</div>}
              {isHost && <div style={{ fontSize: '12px', color: '#FFD700' }}>HOST</div>}
              {isCurrentPlayer && <div style={{ fontSize: '12px', color: '#4CAF50' }}>YOU</div>}
              {isDealer && (
                <div className="dealer-chip">
                  <span>D</span>
                </div>
              )}
              
              {/* Show player's cards only to themselves */}
              {shouldShowCards(player) && player.cards && (
                <div style={{ marginTop: '5px' }}>
                  {player.cards.map((card, cardIndex) => {
                    const cardDisplay = getCardDisplay(card)
                    return (
                      <div key={cardIndex} className={`playing-card ${cardDisplay.isRed ? 'red' : ''}`} style={{ width: '20px', height: '30px', fontSize: '8px', margin: '1px' }}>
                        <div className="card-rank">{card.rank}</div>
                        <div className="card-suit">{cardDisplay.symbol}</div>
                      </div>
                    )
                  })}
                </div>
              )}
              
              {table.host === socket.id && !isCurrentPlayer && (
                <button 
                  className="btn btn-danger" 
                  style={{ fontSize: '10px', padding: '4px 8px', marginTop: '5px' }}
                  onClick={() => handleKickPlayer(player.id)}
                >
                  Kick
                </button>
              )}
            </div>
          )
        })}
      </div>

      {showdownResult && (
        <div className="showdown-result">
          <h3>Showdown!</h3>
          <p>Winner: {showdownResult.winner.name}</p>
          {showdownResult.winningHand && (
            <p>Winning Hand: {showdownResult.winningHand.name}</p>
          )}
          <p>Pot: ${showdownResult.pot}</p>
        </div>
      )}

      {automaticWinResult && (
        <div className="showdown-result">
          <h3>Automatic Win!</h3>
          <p>Winner: {automaticWinResult.winner.name}</p>
          <p>All other players folded!</p>
          <p>Pot: ${automaticWinResult.pot}</p>
        </div>
      )}

      <div className="game-controls">
        {table.host === socket.id && table.gameState === 'waiting' && !gameState && (
          <button 
            className="btn" 
            onClick={handleStartGame}
            disabled={table.players.length < 2}
          >
            Start Game ({table.players.length}/8 players)
          </button>
        )}

        {gameState && gameState.gamePhase && gameState.gamePhase !== 'showdown' && (
          <div>
            <div style={{ marginBottom: '10px' }}>
              {gameState.currentPlayer !== undefined && (
                <span><strong>Current Turn: {gameState.players[gameState.currentPlayer]?.name}</strong></span>
              )}
              {(() => {
                const currentHand = getCurrentPlayerHand()
                return currentHand && currentHand.name !== 'No Cards' ? (
                  <span style={{ color: '#4CAF50', fontWeight: 'bold' }}> | Your Hand: {currentHand.name}</span>
                ) : null
              })()}
            </div>
            
            {gameState.currentPlayer !== undefined && gameState.players && gameState.players[gameState.currentPlayer]?.id === socket.id && !gameState.players[gameState.currentPlayer]?.folded && gameState.players[gameState.currentPlayer]?.isActive !== false && (
              <div className="betting-controls">
                {/* Show all-in indicator */}
                {gameState.players && gameState.players.some(p => p.allIn && !p.folded) && !gameState.players.every(p => p.allIn || p.folded || p.isActive === false) && (
                  <div style={{ 
                    backgroundColor: '#FF6B6B', 
                    color: 'white', 
                    padding: '8px', 
                    borderRadius: '4px', 
                    marginBottom: '10px',
                    textAlign: 'center'
                  }}>
                    <strong>All-In Situation:</strong> No more betting allowed. Only fold action available.
                  </div>
                )}
                
                {/* Show when all active players are all-in */}
                {gameState.players && gameState.players.every(p => p.allIn || p.folded || p.isActive === false) && gameState.players.some(p => p.allIn && !p.folded) && (
                  <div style={{ 
                    backgroundColor: '#4CAF50', 
                    color: 'white', 
                    padding: '8px', 
                    borderRadius: '4px', 
                    marginBottom: '10px',
                    textAlign: 'center'
                  }}>
                    <strong>All Players All-In:</strong> Betting complete. Board will run out automatically.
                  </div>
                )}
                
                {/* Show when there's a multi-way all-in (3+ players) */}
                {gameState.players && gameState.players.filter(p => p.allIn && !p.folded && p.isActive !== false).length >= 3 && (
                  <div style={{ 
                    backgroundColor: '#FF9800', 
                    color: 'white', 
                    padding: '8px', 
                    borderRadius: '4px', 
                    marginBottom: '10px',
                    textAlign: 'center'
                  }}>
                    <strong>Multi-Way All-In:</strong> {gameState.players.filter(p => p.allIn && !p.folded).length} players all-in. Board will run out automatically.
                  </div>
                )}
                
                {/* Show when current player is all-in and cannot act */}
                {gameState.players && gameState.players[gameState.currentPlayer]?.allIn && (
                  <div style={{ 
                    backgroundColor: '#FF9800', 
                    color: 'white', 
                    padding: '8px', 
                    borderRadius: '4px', 
                    marginBottom: '10px',
                    textAlign: 'center'
                  }}>
                    <strong>You are All-In:</strong> No more actions allowed. Waiting for showdown.
                  </div>
                )}
                
                <div className="basic-actions">
                  <button 
                    className="btn" 
                    onClick={() => handlePlayerAction('fold')}
                    disabled={gameState.players && (gameState.players[gameState.currentPlayer]?.allIn || gameState.players.every(p => p.allIn || p.folded || p.isActive === false))}
                    title={gameState.players && gameState.players[gameState.currentPlayer]?.allIn ? "Cannot fold when all-in" : gameState.players && gameState.players.every(p => p.allIn || p.folded || p.isActive === false) ? "All players all-in - no actions allowed" : ""}
                  >
                    Fold
                  </button>
                  {gameState.players && gameState.currentBet > gameState.players[gameState.currentPlayer]?.bet && !gameState.players.every(p => p.allIn || p.folded || p.isActive === false) ? (
                    <button className="btn" onClick={() => handlePlayerAction('call')}>
                      Call ${gameState.currentBet - gameState.players[gameState.currentPlayer]?.bet}
                    </button>
                  ) : (
                    // Only show check button if there are no all-in players and not in multi-way all-in
                    gameState.players && !gameState.players.some(p => p.allIn && !p.folded) && !gameState.players.every(p => p.allIn || p.folded || p.isActive === false) && gameState.players.filter(p => p.allIn && !p.folded && p.isActive !== false).length < 3 && (
                      <button className="btn" onClick={() => handlePlayerAction('check')}>
                        Check
                      </button>
                    )
                  )}
                  {/* Only show raise button if there are no all-in players and not in multi-way all-in */}
                  {gameState.players && !gameState.players.some(p => p.allIn && !p.folded) && !gameState.players.every(p => p.allIn || p.folded || p.isActive === false) && gameState.players.filter(p => p.allIn && !p.folded && p.isActive !== false).length < 3 && (
                    <button className="btn btn-raise" onClick={() => setShowBettingInterface(!showBettingInterface)}>
                      Raise
                    </button>
                  )}
                </div>
                
                {showBettingInterface && (
                  <div className="betting-interface">
                    {/* Hide betting interface if player is all-in or all players are all-in */}
                    {gameState.players && (gameState.players[gameState.currentPlayer]?.allIn || gameState.players.every(p => p.allIn || p.folded || p.isActive === false)) ? (
                      <div style={{ 
                        backgroundColor: '#FF9800', 
                        color: 'white', 
                        padding: '8px', 
                        borderRadius: '4px', 
                        marginBottom: '10px',
                        textAlign: 'center'
                      }}>
                        <strong>No Betting Allowed:</strong> {gameState.players && gameState.players[gameState.currentPlayer]?.allIn ? "You are all-in" : "All players are all-in"}
                      </div>
                    ) : (
                      <>
                        <div style={{ 
                          backgroundColor: '#f0f0f0', 
                          padding: '8px', 
                          borderRadius: '4px', 
                          marginBottom: '10px',
                          fontSize: '12px',
                          textAlign: 'center'
                        }}>
                          <strong>Minimum Raise:</strong> ${getMinRaiseAmount()}
                        </div>
                        <div className="betting-presets">
                          <button className="btn btn-preset" onClick={() => handleBettingPreset('min')}>
                            Min Raise
                          </button>
                          <button className="btn btn-preset" onClick={() => handleBettingPreset('pot')}>
                            Pot (${gameState.pot || 0})
                          </button>
                          <button className="btn btn-preset btn-allin" onClick={() => handleBettingPreset('allin')}>
                            All In
                          </button>
                        </div>
                        
                        <div className="betting-slider">
                          <label htmlFor="raise-slider">Raise Amount: ${raiseAmount}</label>
                          <input
                            id="raise-slider"
                            type="range"
                            min={gameState.currentBet + (table.blinds.big || 20)}
                            max={gameState.players && gameState.players[gameState.currentPlayer]?.stack || 1000}
                            value={raiseAmount}
                            onChange={(e) => setRaiseAmount(parseInt(e.target.value))}
                            className="slider"
                          />
                          <button className="btn" onClick={() => handleRaise(raiseAmount)}>
                            Raise ${raiseAmount}
                          </button>
                        </div>
                        
                        <div className="custom-bet">
                          <input
                            type="number"
                            placeholder="Custom amount"
                            value={customRaiseAmount}
                            onChange={(e) => setCustomRaiseAmount(e.target.value)}
                            min={gameState.currentBet + (table.blinds.big || 20)}
                            max={gameState.players && gameState.players[gameState.currentPlayer]?.stack || 1000}
                            className="custom-bet-input"
                          />
                          <button className="btn" onClick={handleCustomRaise}>
                            Custom Raise
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button 
          className="btn btn-secondary" 
          onClick={() => navigate('/')}
          style={{ marginLeft: '20px' }}
        >
          Leave Table
        </button>
      </div>

      <div className="card">
        <h3>Table Info</h3>
        <p>Blinds: ${table.blinds.small} / ${table.blinds.big}</p>
        <p>Game State: {table.gameState}</p>
        <p>Players: {table.players.length}/8</p>
      </div>
    </div>
  )
}

export default Table 