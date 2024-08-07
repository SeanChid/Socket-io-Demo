import { useState, useEffect } from 'react'
import socket from './socket.js'
import './App.css'

function App() {
  const [message, setMessage] = useState('')
  const [receivedMessage, setReceivedMessage] = useState('')

  useEffect(() => {
    socket.on("message", (msg) => {
      setReceivedMessage(msg)
    })

    return () => {
      socket.off("message")
    }
  }, [])

  const sendMessage = () => {
    socket.emit("message", message)
    setMessage("")
  }

  return (
    <div>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder='Type a message'
      />
      <button onClick={sendMessage}>Send</button>
      <p>Received: {receivedMessage}</p>
    </div>
  )
}

export default App
