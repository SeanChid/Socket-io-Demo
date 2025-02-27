import { useState, useEffect, useRef } from 'react';
import socket from '../socket';
import { formatMessageDate, formatMessageTime, groupMessagesByDate } from '../utils/dateFormatting';
import './styles/PrivateChat.css'

export default function PrivateChat({ chat, onBack }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [error, setError] = useState('');
    const [isJoined, setIsJoined] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        setIsJoined(false);
        setError('');
        setMessages([]);

        // Join the private chat
        socket.emit('join-private-chat', chat.chat_id);

        // Handle successful join
        const handleJoinedChat = ({ chatId }) => {
            if (chatId === chat.chat_id) {
                setIsJoined(true);
                loadMessages();
            }
        };

        // Load messages after successfully joining
        const loadMessages = async () => {
            try {
                const response = await fetch(`/api/private-chats/${chat.chat_id}/messages`, {
                    credentials: 'include'
                });
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to load messages');
                }
                const data = await response.json();
                setMessages(data);
                scrollToBottom();
            } catch (error) {
                setError(error.message);
                if (error.message === 'Not a member of this chat') {
                    setTimeout(() => onBack(), 2000);
                }
            }
        };

        // Listen for new messages in this specific chat
        const handleNewMessage = (message) => {
            if (message.chat_id === chat.chat_id) {
                setMessages(prev => [...prev, message]);
                scrollToBottom();
            }
        };

        // Listen for errors
        const handleError = (error) => {
            setError(error.message);
            if (error.message === 'Not a member of this chat') {
                setTimeout(() => onBack(), 2000);
            }
        };

        socket.on('private-chat-joined', handleJoinedChat);
        socket.on('new-message', handleNewMessage);
        socket.on('error', handleError);

        return () => {
            socket.off('private-chat-joined', handleJoinedChat);
            socket.off('new-message', handleNewMessage);
            socket.off('error', handleError);
            socket.emit('leave-private-chat', chat.chat_id);
        };
    }, [chat.chat_id, onBack]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !isJoined) return;

        socket.emit('send-private-message', {
            chatId: chat.chat_id,
            content: newMessage.trim()
        });

        setNewMessage('');
    };

    if (!isJoined) {
        return (
            <div className="private-chat">
                <div className="chat-header">
                    <button onClick={onBack} className="back-button">←</button>
                    <h2>Joining chat...</h2>
                </div>
                {error && <div className="error-message">{error}</div>}
            </div>
        );
    }

    const messageGroups = groupMessagesByDate(messages);

    return (
        <div className="private-chat">
            <div className="chat-header">
                <button onClick={onBack} className="back-button">←</button>
                <h2>Chat with {chat.other_user.username}</h2>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="messages-container">
                {messageGroups.map((group) => (
                    <div key={group.date.toISOString()} className="message-group">
                        <div className="date-separator">
                            <span>{formatMessageDate(group.date)}</span>
                        </div>
                        {group.messages.map((message) => (
                            <div key={message.message_id} className="message">
                                <div className="message-header">
                                    <span className="username">{message.sender.username}</span>
                                    <span className="timestamp">
                                        {formatMessageTime(message.created_at)}
                                    </span>
                                </div>
                                <div className="message-content">{message.content}</div>
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
