import { useState, useEffect } from 'react'
import './App.css'
import socket from './socket'
import Auth from './components/Auth'
import ChatRoom from './components/ChatRoom'
import PrivateChat from './components/PrivateChat'
import UserSearch from './components/UserSearch'

function App() {
    const [user, setUser] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [privateChats, setPrivateChats] = useState([]);
    const [activeRoom, setActiveRoom] = useState(null);
    const [activePrivateChat, setActivePrivateChat] = useState(null);
    const [showCreateRoom, setShowCreateRoom] = useState(false);
    const [showFindUsers, setShowFindUsers] = useState(false);
    const [newRoomName, setNewRoomName] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (user) {
            // Load rooms and private chats
            loadRooms();
            loadPrivateChats();
        }
    }, [user]);

    const loadRooms = async () => {
        try {
            const response = await fetch('/api/rooms');
            if (!response.ok) throw new Error('Failed to load rooms');
            const data = await response.json();
            setRooms(data);
        } catch (error) {
            setError('Failed to load rooms');
        }
    };

    const loadPrivateChats = async () => {
        try {
            const response = await fetch('/api/private-chats');
            if (!response.ok) throw new Error('Failed to load private chats');
            const data = await response.json();
            setPrivateChats(data);
        } catch (error) {
            setError('Failed to load private chats');
        }
    };

    const handleCreateRoom = async (e) => {
        e.preventDefault();
        if (!newRoomName.trim()) return;

        try {
            const response = await fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: newRoomName.trim(),
                    isPrivate: false
                }),
            });

            if (!response.ok) throw new Error('Failed to create room');
            
            setNewRoomName('');
            setShowCreateRoom(false);
            loadRooms();
        } catch (error) {
            setError('Failed to create room');
        }
    };

    const handleStartPrivateChat = async (selectedUser) => {
        try {
            const response = await fetch('/api/private-chats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: selectedUser.id
                }),
            });

            if (!response.ok) throw new Error('Failed to start chat');
            
            setShowFindUsers(false);
            loadPrivateChats();
        } catch (error) {
            setError('Failed to start private chat');
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            setUser(null);
            setRooms([]);
            setPrivateChats([]);
            setActiveRoom(null);
            setActivePrivateChat(null);
        } catch (error) {
            setError('Failed to logout');
        }
    };

    if (!user) {
        return <Auth onAuthenticated={setUser} />;
    }

    if (activeRoom) {
        return <ChatRoom room={activeRoom} onBack={() => setActiveRoom(null)} />;
    }

    if (activePrivateChat) {
        return <PrivateChat chat={activePrivateChat} onBack={() => setActivePrivateChat(null)} />;
    }

    return (
        <div className="app-container">
            <header className="app-header">
                <h1>Chat App</h1>
                <div className="user-controls">
                    <span>Welcome, {user.username}!</span>
                    <button onClick={handleLogout} className="logout-button">Logout</button>
                </div>
            </header>

            {error && <div className="error-message">{error}</div>}

            <div className="main-content">
                <section className="rooms-section">
                    <div className="section-header">
                        <h2>Chat Rooms</h2>
                        <button onClick={() => setShowCreateRoom(true)} className="create-button">
                            Create Room
                        </button>
                    </div>

                    {showCreateRoom && (
                        <form onSubmit={handleCreateRoom} className="create-room-form">
                            <input
                                type="text"
                                value={newRoomName}
                                onChange={(e) => setNewRoomName(e.target.value)}
                                placeholder="Room name"
                                className="room-name-input"
                            />
                            <button type="submit" className="create-button">Create</button>
                            <button
                                type="button"
                                onClick={() => setShowCreateRoom(false)}
                                className="cancel-button"
                            >
                                Cancel
                            </button>
                        </form>
                    )}

                    <div className="rooms-list">
                        {rooms.map((room) => (
                            <div key={room.room_id} className="room-item" onClick={() => setActiveRoom(room)}>
                                <span className="room-name">{room.name}</span>
                                <span className="member-count">{room.members.length} members</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="private-chats-section">
                    <div className="section-header">
                        <h2>Private Chats</h2>
                        <button onClick={() => setShowFindUsers(true)} className="create-button">
                            New Chat
                        </button>
                    </div>

                    {showFindUsers && (
                        <div className="find-users-modal">
                            <UserSearch onSelectUser={handleStartPrivateChat} buttonText="Start Chat" />
                            <button
                                onClick={() => setShowFindUsers(false)}
                                className="close-button"
                            >
                                Close
                            </button>
                        </div>
                    )}

                    <div className="private-chats-list">
                        {privateChats.map((chat) => (
                            <div
                                key={chat.chat_id}
                                className="private-chat-item"
                                onClick={() => setActivePrivateChat(chat)}
                            >
                                <span className="username">{chat.other_user.username}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}

export default App;
