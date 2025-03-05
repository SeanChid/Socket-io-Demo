import { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import useUnreadStore from '../store/unreadStore';
import { formatMessageDate, formatMessageTime, groupMessagesByDate } from '../utils/dateFormatting';
import './styles/ChatRoom.css';

export default function ChatRoom({ room, onBack }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [error, setError] = useState('');
    const [isJoined, setIsJoined] = useState(false);
    const messagesEndRef = useRef(null);
    const { clearUnread } = useUnreadStore();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        setIsJoined(false);
        setError('');
        setMessages([]);

        // Join the room
        socket.emit('join-room', room.room_id);

        // Load existing messages
        const loadMessages = async () => {
            try {
                const response = await fetch(`/api/rooms/${room.room_id}/messages`, {
                    credentials: 'include'
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to load messages');
                }
                const data = await response.json();
                setMessages(data);
                setIsJoined(true);
                // Clear unread count when messages are loaded
                clearUnread(room.room_id, true);
                scrollToBottom();
            } catch (error) {
                setError(error.message);
                if (error.message === 'Not a member of this room') {
                    setTimeout(() => onBack(), 2000);
                }
            }
        };

        loadMessages();

        // Listen for new messages
        const handleNewMessage = (message) => {
            setMessages(prev => [...prev, message]);
            // Clear unread count when new message arrives while in room
            if (message.roomId === room.room_id) {
                clearUnread(room.room_id, true);
            }
            scrollToBottom();
        };

        // Listen for errors
        const handleError = (error) => {
            setError(error.message);
            if (error.message === 'Not a member of this room' || error.message === 'You need an invite to join this room') {
                setTimeout(() => onBack(), 2000);
            }
        };

        socket.on('new-message', handleNewMessage);
        socket.on('error', handleError);

        return () => {
            socket.off('new-message', handleNewMessage);
            socket.off('error', handleError);
            socket.emit('leave-room', room.room_id);
        };
    }, [room.room_id, onBack, clearUnread]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !isJoined) return;

        socket.emit('send-room-message', {
            roomId: room.room_id,
            content: newMessage.trim()
        });

        setNewMessage('');
    };

    if (!isJoined) {
        return (
            <div className="chat-room">
                <div className="chat-header">
                    <button onClick={onBack} className="back-button">←</button>
                    <h2>Joining room...</h2>
                </div>
                {error && <div className="error-message">{error}</div>}
            </div>
        );
    }

    const messageGroups = groupMessagesByDate(messages);

    return (
        <div className="chat-room">
            <div className="chat-header">
                <button onClick={onBack} className="back-button">←</button>
                <h2>{room.name}</h2>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="messages-container">
                {messageGroups.map((group) => (
                    <div key={group.date.toISOString()} className="message-group">
                        <div className="date-separator">
                            <span>{formatMessageDate(group.date)}</span>
                        </div>
                        {group.messages.map((message) => (
                            <div key={message.message_id || `system-${message.created_at}`} 
                                 className={`message ${message.type === 'system' ? 'system-message' : ''}`}>
                                {message.type === 'system' ? (
                                    <div className="system-content">{message.content}</div>
                                ) : (
                                    <>
                                        <div className="message-header">
                                            <span className="username">{message.sender.username}</span>
                                            <span className="timestamp">
                                                {formatMessageTime(message.created_at)}
                                            </span>
                                        </div>
                                        <div className="message-content">{message.content}</div>
                                    </>
                                )}
                            </div>
                        ))}
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
                />
                <button type="submit" className="send-button">Send</button>
            </form>
        </div>
    );
}
