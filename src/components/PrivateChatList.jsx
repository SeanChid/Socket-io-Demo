import { useState, useEffect } from 'react';
import socket from '../socket';
import useUnreadStore from '../store/unreadStore';
import UnreadBadge from './UnreadBadge';
import './styles/PrivateChat.css';

function PrivateChatList({ privateChats, onChatSelect, onFindUsers, selectedChat }) {
    const { getUnreadCount, clearUnread } = useUnreadStore();

    useEffect(() => {
        // Listen for new messages to update unread counts
        const handleNewMessage = (message) => {
            // Only increment if message is for a private chat and we're not in that chat
            if (message.privateChatId && (!selectedChat || message.privateChatId !== selectedChat.chat_id)) {
                useUnreadStore.getState().incrementUnread(message.privateChatId, false);
            }
        };

        const handleNotification = (notification) => {
            // Only increment if notification is for a private chat and we're not in that chat
            if (notification.type === 'private' && (!selectedChat || notification.chatId !== selectedChat.chat_id)) {
                useUnreadStore.getState().incrementUnread(notification.chatId, false);
            }
        };

        socket.on('new-message', handleNewMessage);
        socket.on('message-notification', handleNotification);

        return () => {
            socket.off('new-message', handleNewMessage);
            socket.off('message-notification', handleNotification);
        };
    }, [selectedChat]);

    const handleChatClick = (chat) => {
        clearUnread(chat.chat_id, false);
        onChatSelect(chat);
    };

    return (
        <div className="private-chats-section">
            <div className="section-header">
                <h2>Private Chats</h2>
                <button onClick={onFindUsers} className="find-users-button">
                    Find Users
                </button>
            </div>

            <div className="private-chat-list">
                {privateChats.length === 0 ? (
                    <div className="no-chats">
                        <p>No private chats yet.</p>
                        <p>Find users to start chatting!</p>
                    </div>
                ) : (
                    privateChats.map(chat => (
                        <div 
                            key={chat.chat_id} 
                            className={`private-chat-item ${selectedChat?.chat_id === chat.chat_id ? 'selected' : ''}`}
                            onClick={() => handleChatClick(chat)}
                        >
                            <div className="chat-info">
                                <span className="user-name">{chat.other_user.username}</span>
                                <UnreadBadge count={getUnreadCount(chat.chat_id, false)} />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default PrivateChatList;
