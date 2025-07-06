import { Routes, Route } from 'react-router-dom'
import Home from './components/Home'
import Table from './components/Table'
import './App.css'

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/table/:tableId" element={<Table />} />
      </Routes>
    </div>
  )
}

export default App 