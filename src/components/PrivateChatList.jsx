import { useState } from 'react';
import useUnreadStore from '../store/unreadStore';
import UnreadBadge from './UnreadBadge';
import './styles/PrivateChat.css';

function PrivateChatList({ privateChats, onChatSelect, onFindUsers, selectedChat }) {
    const { getUnreadCount } = useUnreadStore();

    const handleChatClick = (chat) => {
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
