import { useState, useEffect, useRef } from 'react'
import io from 'socket.io-client'
import EmojiPicker from 'emoji-picker-react'
import './App.css'

function App() {
  const [socket, setSocket] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [username, setUsername] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginError, setLoginError] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    const newSocket = io()
    setSocket(newSocket)

    newSocket.on('username set', (username) => {
      setIsLoggedIn(true)
    })

    newSocket.on('user joined', (data) => {
      setMessages(prev => [...prev, data])
    })

    newSocket.on('user left', (data) => {
      setMessages(prev => [...prev, data])
    })

    return () => newSocket.close()
  }, [])

  useEffect(() => {
    if (!socket) return

    socket.on('chat message', (msg) => {
      setMessages(prevMessages => [...prevMessages, msg])
    })

    return () => {
      socket.off('chat message')
    }
  }, [socket])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleLogin = (e) => {
    e.preventDefault()
    if (!username.trim()) {
      setLoginError('Please enter a username')
      return
    }
    if (username.length < 3) {
      setLoginError('Username must be at least 3 characters long')
      return
    }
    socket.emit('set username', username.trim())
    setLoginError('')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (inputMessage.trim() && socket) {
      socket.emit('chat message', inputMessage)
      setInputMessage('')
      setShowEmojiPicker(false)
    }
  }

  const onEmojiClick = (emojiObject) => {
    setInputMessage(prevInput => prevInput + emojiObject.emoji)
  }

  const handleLeaveChat = () => {
    if (socket) {
      socket.emit('leave chat', username)
      setIsLoggedIn(false)
      setUsername('')
      setMessages([])
      socket.disconnect()
      
      // Reconnect with a new socket for future logins
      const newSocket = io()
      setSocket(newSocket)
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>Join the Chat</h2>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="login-input"
            />
            {loginError && <p className="error-message">{loginError}</p>}
            <button type="submit" className="login-button">Join Chat</button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="header-content">
          <h2>Welcome, {username}!</h2>
          <button onClick={handleLeaveChat} className="leave-button">
            Leave Chat
          </button>
        </div>
      </div>
      <div className="messages">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message ${
              msg.type === 'system' 
                ? 'system' 
                : msg.userId === socket?.id 
                  ? 'sent' 
                  : 'received'
            }`}
          >
            {msg.type === 'system' ? (
              <p className="system-message">{msg.message}</p>
            ) : (
              <>
                <span className="user-id">{msg.username}</span>
                <p>{msg.message}</p>
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="input-container">
        {showEmojiPicker && (
          <div className="emoji-picker-container">
            <EmojiPicker onEmojiClick={onEmojiClick} />
          </div>
        )}
        <form onSubmit={handleSubmit} className="input-form">
          <button
            type="button"
            className="emoji-button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            😊
          </button>
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a message..."
          />
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  )
}

export default App
