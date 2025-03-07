import { useState, useEffect, useCallback } from 'react';
import './styles/Modal.css';

function UserSearch({ onSelectUser, onClose, buttonText = "Select" }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState([]);
    const [error, setError] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    const searchUsers = useCallback(async (query) => {
        if (!query.trim()) {
            setUsers([]);
            return;
        }

        setIsSearching(true);
        try {
            const response = await fetch(`/api/users/search?query=${encodeURIComponent(query)}`, {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to search users');
            const data = await response.json();
            setUsers(data);
            setError('');
        } catch (error) {
            setError('Failed to search users');
            setUsers([]);
        } finally {
            setIsSearching(false);
        }
    }, []);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            searchUsers(searchTerm);
        }, 300); // Debounce for 300ms

        return () => clearTimeout(timeoutId);
    }, [searchTerm, searchUsers]);

    const handleClose = () => {
        setSearchTerm('');
        setUsers([]);
        setError('');
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>Find Users</h2>

                {error && <div className="error-message">{error}</div>}

                <div className="search-container">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Type to search users..."
                        autoFocus
                    />
                    {isSearching && <div className="search-spinner"></div>}
                </div>

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
                    {users.length === 0 && searchTerm.trim() && !isSearching && (
                        <div className="no-results">
                            No users found
                        </div>
                    )}
                </div>

                <div className="modal-actions">
                    <button type="button" onClick={handleClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

export default UserSearch;
