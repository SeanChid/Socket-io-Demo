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
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)
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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      alert('File size must be less than 5MB')
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      socket.emit('media message', {
        url: data.url,
        filename: data.filename,
        type: data.type
      })
    } catch (error) {
      alert('Error uploading file: ' + error.message)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
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

  const onEmojiClick = (emojiObject) => {
    setInputMessage(prevInput => prevInput + emojiObject.emoji)
  }

  const renderMessage = (msg) => {
    if (msg.type === 'system') {
      return <p className="system-message">{msg.message}</p>
    }

    if (msg.isMedia) {
      const isImage = msg.mediaType?.startsWith('image/')
      return (
        <>
          <span className="user-id">{msg.username}</span>
          <div className="media-container">
            {isImage ? (
              <img 
                src={msg.mediaUrl} 
                alt={msg.message} 
                className="media-image"
                onClick={() => window.open(msg.mediaUrl, '_blank')}
              />
            ) : (
              <a 
                href={msg.mediaUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="media-file"
              >
                📎 {msg.message}
              </a>
            )}
          </div>
        </>
      )
    }

    return (
      <>
        <span className="user-id">{msg.username}</span>
        <p>{msg.message}</p>
      </>
    )
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
            {renderMessage(msg)}
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
          <label className="upload-button">
            📎
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*,.pdf,.doc,.docx,.txt"
              style={{ display: 'none' }}
              disabled={isUploading}
            />
          </label>
          <button type="submit">Send</button>
        </form>
      </div>
    </div>
  )
}

export default App
