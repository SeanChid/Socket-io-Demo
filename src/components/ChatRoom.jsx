import { useState, useEffect, useRef } from 'react';
import socket from '../socket';

export default function ChatRoom({ room, onBack }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        // Load existing messages
        const loadMessages = async () => {
            try {
                const response = await fetch(`/api/rooms/${room.room_id}/messages`, {
                    credentials: 'include'
                });
                if (!response.ok) throw new Error('Failed to load messages');
                const data = await response.json();
                setMessages(data);
                scrollToBottom();
            } catch (error) {
                setError('Failed to load messages');
            }
        };

        loadMessages();

        // Join the room
        socket.emit('join-room', room.room_id);

        // Listen for new messages from others
        const handleNewMessage = (message) => {
            setMessages(prev => {
                // Replace temporary message if it exists (for current user's messages)
                const messageExists = prev.some(m => 
                    m.content === message.content && 
                    ((m.sender?.id === message.sender?.id) || 
                     (m.sender?.id === room.current_user.id && message.sender?.id === room.current_user.id)) &&
                    Math.abs(new Date(m.created_at) - new Date(message.created_at)) < 5000
                );
                
                if (messageExists) {
                    return prev.map(m => 
                        (m.content === message.content && 
                         ((m.sender?.id === message.sender?.id) || 
                          (m.sender?.id === room.current_user.id && message.sender?.id === room.current_user.id)) &&
                         Math.abs(new Date(m.created_at) - new Date(message.created_at)) < 5000)
                        ? message 
                        : m
                    );
                }
                
                return [...prev, message];
            });
            scrollToBottom();
        };

        socket.on('new-message', handleNewMessage);
        socket.on('error', (error) => setError(error.message));

        return () => {
            socket.off('new-message', handleNewMessage);
            socket.off('error');
            socket.emit('leave-room', room.room_id);
        };
    }, [room.room_id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || sending) return;

        const messageContent = newMessage.trim();
        setNewMessage('');
        setSending(true);

        try {
            // Optimistically add the message
            const tempMessage = {
                message_id: Date.now(), // temporary ID
                content: messageContent,
                created_at: new Date().toISOString(),
                sender: {
                    id: room.current_user.id,
                    username: room.current_user.username
                }
            };
            
            setMessages(prev => [...prev, tempMessage]);
            scrollToBottom();

            // Send the message
            socket.emit('send-room-message', {
                roomId: room.room_id,
                content: messageContent
            });

        } catch (error) {
            setError('Failed to send message. Please try again.');
            // Remove the optimistically added message
            setMessages(prev => prev.filter(msg => msg.message_id !== tempMessage.message_id));
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="chat-room">
            <div className="chat-header">
                <button onClick={onBack} className="back-button">←</button>
                <h2>{room.name}</h2>
                <div className="room-members">
                    {room.members?.length} members
                </div>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                    <button onClick={() => setError('')}>×</button>
                </div>
            )}

            <div className="messages-container">
                {messages.map((message) => (
                    <div 
                        key={message.message_id} 
                        className={`message ${message.sender.id === room.current_user.id ? 'own-message' : ''}`}
                    >
                        <div className="message-header">
                            <span className="username">{message.sender.username}</span>
                            <span className="timestamp">
                                {new Date(message.created_at).toLocaleTimeString()}
                            </span>
                        </div>
                        <div className="message-content">{message.content}</div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="message-form">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="message-input"
                    disabled={sending}
                />
                <button type="submit" className="send-button" disabled={sending}>
                    {sending ? 'Sending...' : 'Send'}
                </button>
            </form>
        </div>
    );
}
