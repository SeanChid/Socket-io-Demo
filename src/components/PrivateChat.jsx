import { useState, useEffect, useRef } from 'react';
import socket from '../socket';

export default function PrivateChat({ chat, onBack }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [error, setError] = useState('');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        // Load existing messages
        const loadMessages = async () => {
            try {
                const response = await fetch(`/api/private-chats/${chat.chat_id}/messages`);
                if (!response.ok) throw new Error('Failed to load messages');
                const data = await response.json();
                setMessages(data);
                scrollToBottom();
            } catch (error) {
                setError('Failed to load messages');
            }
        };

        loadMessages();

        // Join the private chat
        socket.emit('join-private-chat', chat.chat_id);

        // Listen for new messages
        const handleNewMessage = (message) => {
            setMessages(prev => [...prev, message]);
            scrollToBottom();
        };

        socket.on('new-message', handleNewMessage);

        return () => {
            socket.off('new-message', handleNewMessage);
            socket.emit('leave-private-chat', chat.chat_id);
        };
    }, [chat.chat_id]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        socket.emit('send-private-message', {
            chatId: chat.chat_id,
            content: newMessage.trim()
        });

        setNewMessage('');
    };

    return (
        <div className="private-chat">
            <div className="chat-header">
                <button onClick={onBack} className="back-button">←</button>
                <h2>Chat with {chat.other_user.username}</h2>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="messages-container">
                {messages.map((message) => (
                    <div key={message.message_id} className="message">
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
                />
                <button type="submit" className="send-button">Send</button>
            </form>
        </div>
    );
}
