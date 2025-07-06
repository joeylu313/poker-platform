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

    socket.on('kicked', (data) => {
      console.log('You were kicked:', data)
      alert(data.message)
      navigate('/')
    })

    socket.on('error', (data) => {
      console.log('Error:', data)
      setError(data.message)
    })

    return () => {
      console.log('Cleaning up Table component event listeners')
      socket.off('tableUpdate')
      socket.off('gameStarted')
      socket.off('gameUpdate')
      socket.off('bettingRoundComplete')
      socket.off('showdown')
      socket.off('automaticWin')
      socket.off('newHand')
      socket.off('playerJoined')
      socket.off('playerLeft')
      socket.off('playerKicked')
      socket.off('kicked')
      socket.off('error')
    }
  }, [navigate])

  const handleStartGame = () => {
    if (table && table.players.length >= 2) {
      socket.emit('startGame', tableId)
    }
  }

  const handleKickPlayer = (playerId) => {
    socket.emit('kickPlayer', { tableId, playerId })
  }

  const handlePlayerAction = (action, amount = 0) => {
    console.log('Sending player action:', { tableId, action, amount });
    socket.emit('playerAction', { tableId, action, amount })
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

  // Calculate player positions around the table
  const getPlayerPosition = (index, totalPlayers) => {
    const angle = (index / totalPlayers) * 2 * Math.PI - Math.PI / 2
    const radius = 150
    return {
      left: `${400 + radius * Math.cos(angle)}px`,
      top: `${300 + radius * Math.sin(angle)}px`
    }
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

      <div className="poker-table">
        <div className="pot">
          Pot: ${gameState ? gameState.pot : 0}
        </div>

        <div className="community-cards">
          {gameState && gameState.communityCards.map((card, index) => {
            const cardDisplay = getCardDisplay(card)
            return (
              <div key={index} className={`card ${cardDisplay.isRed ? 'red' : ''}`}>
                <div className="card-rank">{card.rank}</div>
                <div className="card-suit">{cardDisplay.symbol}</div>
              </div>
            )
          })}
        </div>

        {(gameState ? gameState.players : table.players).map((player, index) => {
          const position = getPlayerPosition(index, (gameState ? gameState.players : table.players).length)
          const isCurrentPlayer = player.id === socket.id
          const isHost = player.id === table.host
          const isCurrentTurn = gameState && gameState.currentPlayer === index

          return (
            <div
              key={player.id}
              className={`player-seat ${isCurrentPlayer ? 'active' : ''} ${isHost ? 'dealer' : ''} ${isCurrentTurn ? 'current-turn' : ''}`}
              style={position}
            >
              <div>{player.name}</div>
              <div>${player.stack}</div>
              {player.bet > 0 && <div style={{ fontSize: '12px', color: '#FFD700' }}>Bet: ${player.bet}</div>}
              {player.folded && <div style={{ fontSize: '12px', color: '#f44336' }}>FOLDED</div>}
              {player.allIn && <div style={{ fontSize: '12px', color: '#FF6B6B' }}>ALL IN</div>}
              {isHost && <div style={{ fontSize: '12px', color: '#FFD700' }}>HOST</div>}
              {isCurrentPlayer && <div style={{ fontSize: '12px', color: '#4CAF50' }}>YOU</div>}
              
              {/* Show player's cards only to themselves */}
              {shouldShowCards(player) && (
                <div style={{ marginTop: '5px' }}>
                  {player.cards.map((card, cardIndex) => {
                    const cardDisplay = getCardDisplay(card)
                    return (
                      <div key={cardIndex} className={`card ${cardDisplay.isRed ? 'red' : ''}`} style={{ width: '20px', height: '30px', fontSize: '8px', margin: '1px' }}>
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
        {table.host === socket.id && table.gameState === 'waiting' && (
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
              <strong>Phase: {gameState.gamePhase.toUpperCase()}</strong>
              {gameState.currentPlayer !== undefined && (
                <span> | Current Turn: {gameState.players[gameState.currentPlayer]?.name}</span>
              )}
            </div>
            
            {gameState.currentPlayer !== undefined && gameState.players[gameState.currentPlayer]?.id === socket.id && !gameState.players[gameState.currentPlayer]?.folded && (
              <div>
                <button className="btn" onClick={() => handlePlayerAction('fold')}>
                  Fold
                </button>
                {gameState.currentBet > gameState.players[gameState.currentPlayer]?.bet ? (
                  <button className="btn" onClick={() => handlePlayerAction('call')}>
                    Call ${gameState.currentBet - gameState.players[gameState.currentPlayer]?.bet}
                  </button>
                ) : (
                  <button className="btn" onClick={() => handlePlayerAction('check')}>
                    Check
                  </button>
                )}
                <button className="btn" onClick={() => handlePlayerAction('raise', 50)}>
                  Raise $50
                </button>
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