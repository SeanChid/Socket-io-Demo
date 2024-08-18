import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import './App.css'

const socket = io('http://localhost:8000')

function App() {
  const [messages, setMesssages] = useState([])
  const [input, setInput] = useState('')

  useEffect(() => {
    socket.on('chat message', (msg) => {
      setMesssages((prevMessages) => [...prevMessages, msg])
    })

    return () => {
      socket.off('chat message')
    }
  }, [])

  const sendMessage = () => {
    if (input) {
      socket.emit('chat message', input)
      setInput('')
    }
  }

  return (
    <div>
      <ul>
        {messages.map((msg, index) => {
          <li key={index}>{msg}</li>
        })}
      </ul>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder='Type a message'
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  )
}

export default App
