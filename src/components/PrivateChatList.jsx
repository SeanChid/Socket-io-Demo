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
                {privateChats.length === 0 ? (
                    <div className="no-chats">
                        <p>No private chats yet.</p>
                        <p>Find users to start chatting!</p>
                    </div>
                ) : (
                    privateChats.map(chat => (
                        <div 
                            key={chat.chat_id} 
                            className="private-chat-item"
                            onClick={() => onChatSelect(chat)}
                        >
                            <div className="chat-info">
                                <span className="user-name">{chat.other_user.username}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default PrivateChatList;
