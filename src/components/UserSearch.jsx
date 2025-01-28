import { useState } from 'react';

export default function UserSearch({ onSelectUser, buttonText = "Chat" }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [error, setError] = useState('');

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchTerm.trim()) return;

        try {
            const response = await fetch(`/api/users/search?query=${encodeURIComponent(searchTerm)}`);
            if (!response.ok) throw new Error('Search failed');
            const data = await response.json();
            setSearchResults(data);
            setError('');
        } catch (error) {
            setError('Failed to search users');
        }
    };

    return (
        <div className="user-search">
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

            {error && <div className="error-message">{error}</div>}

            <div className="search-results">
                {searchResults.map((user) => (
                    <div key={user.id} className="user-item">
                        <div className="user-info">
                            <span className="username">{user.username}</span>
                            {user.avatar_url && (
                                <img
                                    src={user.avatar_url}
                                    alt={`${user.username}'s avatar`}
                                    className="avatar"
                                />
                            )}
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
