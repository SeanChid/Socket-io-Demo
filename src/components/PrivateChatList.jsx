function PrivateChatList({ privateChats, onChatSelect, onFindUsers, showFindUsers }) {
    return (
        <div className="private-chats-section">
            <div className="section-header">
                <h2>Private Chats</h2>
                <button 
                    className="create-button"
                    onClick={() => onFindUsers(true)}
                >
                    Find Users
                </button>
            </div>

            <div className="private-chat-list">
                {privateChats.map(chat => (
                    <div 
                        key={chat.chat_id} 
                        className="private-chat-item"
                        onClick={() => onChatSelect(chat)}
                    >
                        <span>{chat.other_user.username}</span>
                        {/* Add online status indicator here if implemented */}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default PrivateChatList;
