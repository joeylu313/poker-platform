import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../socket'

function Home() {
  const [playerName, setPlayerName] = useState('')
  const [stackSize, setStackSize] = useState(1000)
  const [blinds, setBlinds] = useState({ small: 10, big: 20 })
  const [joinTableId, setJoinTableId] = useState('')
  const [error, setError] = useState('')
  const [createdTable, setCreatedTable] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    console.log('Home component mounted')
    console.log('Socket connected:', socket.connected)

    socket.on('tableCreated', (table) => {
      console.log('Table created:', table)
      setCreatedTable(table)
    })

    socket.on('error', (data) => {
      console.log('Error:', data)
      setError(data.message)
    })

    return () => {
      console.log('Cleaning up Home component event listeners')
      socket.off('tableCreated')
      socket.off('error')
    }
  }, [])

  const handleCreateTable = () => {
    if (!playerName.trim()) {
      setError('Please enter a player name')
      return
    }

    console.log('Creating table with blinds:', blinds)
    socket.emit('createTable', { blinds })
  }

  const handleJoinTable = () => {
    if (!playerName.trim()) {
      setError('Please enter a player name')
      return
    }

    if (!joinTableId.trim()) {
      setError('Please enter a table ID')
      return
    }

    console.log('Joining table:', joinTableId)
    socket.emit('joinTable', {
      tableId: joinTableId,
      playerName,
      stackSize
    })

    // Navigate to the table
    navigate(`/table/${joinTableId}`)
  }

  const handleJoinCreatedTable = () => {
    if (!playerName.trim()) {
      setError('Please enter a player name')
      return
    }

    if (!createdTable) {
      setError('No table created')
      return
    }

    console.log('Joining created table:', createdTable.id)
    socket.emit('joinTable', {
      tableId: createdTable.id,
      playerName,
      stackSize
    })

    // Navigate to the table
    navigate(`/table/${createdTable.id}`)
  }

  const copyInviteLink = () => {
    if (createdTable) {
      navigator.clipboard.writeText(createdTable.inviteLink)
      alert('Invite link copied to clipboard!')
    }
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Texas Hold'em Poker</h1>
        <p>Create or join a table to start playing</p>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card">
        <h2>Player Settings</h2>
        <div className="form-group">
          <label>Player Name:</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
          />
        </div>
        <div className="form-group">
          <label>Starting Stack:</label>
          <input
            type="number"
            value={stackSize}
            onChange={(e) => setStackSize(parseInt(e.target.value))}
            min="100"
            max="10000"
          />
        </div>
      </div>

      <div className="card">
        <h2>Create Table</h2>
        <div className="form-group">
          <label>Small Blind:</label>
          <input
            type="number"
            value={blinds.small}
            onChange={(e) => setBlinds({ ...blinds, small: parseInt(e.target.value) })}
            min="1"
            max="100"
          />
        </div>
        <div className="form-group">
          <label>Big Blind:</label>
          <input
            type="number"
            value={blinds.big}
            onChange={(e) => setBlinds({ ...blinds, big: parseInt(e.target.value) })}
            min="2"
            max="200"
          />
        </div>
        <button className="btn" onClick={handleCreateTable}>
          Create Table
        </button>
      </div>

      {createdTable && (
        <div className="card">
          <h2>Table Created!</h2>
          <p><strong>Table ID:</strong> {createdTable.id}</p>
          <p><strong>Invite Link:</strong> {createdTable.inviteLink}</p>
          <button className="btn" onClick={copyInviteLink}>
            Copy Invite Link
          </button>
          <button className="btn" onClick={handleJoinCreatedTable}>
            Join Table
          </button>
        </div>
      )}

      <div className="card">
        <h2>Join Table</h2>
        <div className="form-group">
          <label>Table ID:</label>
          <input
            type="text"
            value={joinTableId}
            onChange={(e) => setJoinTableId(e.target.value.toUpperCase())}
            placeholder="Enter 5-character table ID"
            maxLength="5"
            style={{ textTransform: 'uppercase' }}
          />
        </div>
        <button className="btn" onClick={handleJoinTable}>
          Join Table
        </button>
      </div>

      <div className="card">
        <h3>How to Play</h3>
        <ol>
          <li>Enter your player name and starting stack</li>
          <li>Create a table or join an existing one using the 5-character table ID</li>
          <li>Share the invite link with friends to join your table</li>
          <li>Start the game when ready (minimum 2 players)</li>
          <li>Play Texas Hold'em poker with real-time updates!</li>
        </ol>
      </div>
    </div>
  )
}

export default Home 