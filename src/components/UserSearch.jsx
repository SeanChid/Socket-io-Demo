import { useState } from 'react';

function UserSearch({ onSelectUser, onClose, buttonText = "Select" }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState([]);
    const [error, setError] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;

        try {
            const response = await fetch(`/api/users/search?query=${encodeURIComponent(searchTerm)}`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to search users');
            const data = await response.json();
            setUsers(data);
        } catch (error) {
            setError('Failed to search users');
        }
    };

    return (
        <div className="user-search">
            <div className="user-search-header">
                <h3>Find Users</h3>
                <button onClick={onClose} className="close-button">×</button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleSearch} className="search-form">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search users..."
                    className="search-input"
                />
                <button type="submit" className="search-button">Search</button>
            </form>

            <div className="user-list">
                {users.map(user => (
                    <div key={user.id} className="user-item">
                        <div className="user-info">
                            {user.avatar_url && (
                                <img 
                                    src={user.avatar_url} 
                                    alt={user.username} 
                                    className="avatar"
                                />
                            )}
                            <span>{user.username}</span>
                        </div>
                        <button 
                            onClick={() => onSelectUser(user)}
                            className="action-button"
                        >
                            {buttonText}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default UserSearch;
