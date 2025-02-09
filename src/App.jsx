import { useState, useEffect } from 'react'
import './App.css'
import socket from './socket'
import Auth from './components/Auth'
import ChatRoom from './components/ChatRoom'
import PrivateChat from './components/PrivateChat'
import UserSearch from './components/UserSearch'
import Header from './components/Header'
import RoomList from './components/RoomList'
import PrivateChatList from './components/PrivateChatList'
import LoadingSpinner from './components/LoadingSpinner'
import ErrorMessage from './components/ErrorMessage'
import RoomInvites from './components/RoomInvites'
import AvailableRooms from './components/AvailableRooms'

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [rooms, setRooms] = useState([]);
    const [privateChats, setPrivateChats] = useState([]);
    const [activeRoom, setActiveRoom] = useState(null);
    const [activePrivateChat, setActivePrivateChat] = useState(null);
    const [showCreateRoom, setShowCreateRoom] = useState(false);
    const [showFindUsers, setShowFindUsers] = useState(false);
    const [showInviteUsers, setShowInviteUsers] = useState(false);
    const [activeInviteRoom, setActiveInviteRoom] = useState(null);
    const [newRoomName, setNewRoomName] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        checkSession();
    }, []);

    useEffect(() => {
        if (user) {
            loadRooms();
            loadPrivateChats();
            setupSocketListeners();
        } else {
            socket.disconnect();
        }

        return () => {
            socket.off('connect');
            socket.off('connect_error');
            socket.off('user-online');
            socket.off('user-offline');
        };
    }, [user]);

    const setupSocketListeners = () => {
        socket.connect();
        
        socket.on('connect', () => {
            console.log('Socket connected');
        });

        socket.on('connect_error', (error) => {
            if (error.message === 'Unauthorized') {
                setUser(null);
                socket.disconnect();
            }
        });

        socket.on('user-online', ({ username }) => {
            console.log(`${username} is online`);
        });

        socket.on('user-offline', ({ username }) => {
            console.log(`${username} is offline`);
        });
    };

    const checkSession = async () => {
        try {
            const response = await fetch('/api/session');
            const data = await response.json();
            
            if (data.authenticated) {
                setUser(data.user);
            }
        } catch (error) {
            console.error('Session check failed:', error);
        } finally {
            setLoading(false);
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
            socket.disconnect();
        } catch (error) {
            setError('Failed to logout');
        }
    };

    const loadRooms = async () => {
        try {
            const response = await fetch('/api/rooms');
            if (!response.ok) {
                if (response.status === 401) {
                    setUser(null);
                    return;
                }
                throw new Error('Failed to load rooms');
            }
            const data = await response.json();
            setRooms(data);
        } catch (error) {
            setError('Failed to load rooms');
        }
    };

    const loadPrivateChats = async () => {
        try {
            const response = await fetch('/api/private-chats');
            if (!response.ok) {
                if (response.status === 401) {
                    setUser(null);
                    return;
                }
                throw new Error('Failed to load private chats');
            }
            const data = await response.json();
            setPrivateChats(data);
        } catch (error) {
            setError('Failed to load private chats');
        }
    };

    const handleCreateRoom = async (roomName) => {
        try {
            const response = await fetch('/api/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: roomName,
                    isPrivate: false,
                }),
                credentials: 'include' // Add this to include session cookie
            });

            if (!response.ok) {
                if (response.status === 401) {
                    setUser(null);
                    return;
                }
                const data = await response.json();
                throw new Error(data.error || 'Failed to create room');
            }
            
            setNewRoomName('');
            setShowCreateRoom(false);
            await loadRooms(); // Wait for rooms to load
        } catch (error) {
            setError(error.message || 'Failed to create room');
        }
    };

    const handleStartPrivateChat = async (userId) => {
        try {
            const response = await fetch('/api/private-chats', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: userId.id || userId // handle both user object and direct id
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 401) {
                    setUser(null);
                    return;
                }
                const data = await response.json();
                throw new Error(data.error || 'Failed to start chat');
            }
            
            await loadPrivateChats(); // Reload the private chats list
            setShowFindUsers(false);
        } catch (error) {
            setError(error.message || 'Failed to start private chat');
        }
    };

    const handleInviteToRoom = async (userId) => {
        try {
            const response = await fetch(`/api/rooms/${activeInviteRoom.room_id}/invites`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: userId.id || userId
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 401) {
                    setUser(null);
                    return;
                }
                const data = await response.json();
                throw new Error(data.error || 'Failed to invite user');
            }

            setShowInviteUsers(false);
            setActiveInviteRoom(null);
            setError('User invited successfully!');
        } catch (error) {
            setError(error.message || 'Failed to invite user');
        }
    };

    const handleShowInviteUsers = (room) => {
        setActiveInviteRoom(room);
        setShowInviteUsers(true);
    };

    const handleRoomSelect = async (room) => {
        try {
            // Check if we're already a member or the creator
            const isMember = room.members.some(member => member.id === user.id);
            const isCreator = room.created_by === user.id;
            
            if (!isMember && !isCreator) {
                const response = await fetch(`/api/rooms/${room.room_id}/join`, {
                    method: 'POST',
                    credentials: 'include'
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        setUser(null);
                        return;
                    }
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to join room');
                }

                // Get the updated room data from the response
                const updatedRoom = await response.json();
                // Update the rooms list with the new room data
                setRooms(prevRooms => 
                    prevRooms.map(r => 
                        r.room_id === updatedRoom.room_id ? updatedRoom : r
                    )
                );
                // Set the active room to the updated room data
                setActiveRoom(updatedRoom);
                return;
            }

            // If we're already a member or creator, just set the active room
            setActiveRoom(room);
        } catch (error) {
            setError(error.message || 'Failed to join room');
        }
    };

    if (loading) {
        return <LoadingSpinner />;
    }

    if (!user) {
        return <Auth onAuth={setUser} />;
    }

    if (activeRoom) {
        return (
            <ChatRoom
                room={{
                    ...activeRoom,
                    current_user: {
                        id: user.id,
                        username: user.username
                    }
                }}
                onBack={async () => {
                    setActiveRoom(null);
                    // Reload the rooms list to get updated membership status
                    await loadRooms();
                }}
            />
        );
    }

    if (activePrivateChat) {
        return (
            <PrivateChat
                chat={activePrivateChat}
                onBack={() => setActivePrivateChat(null)}
                userId={user.id}
            />
        );
    }

    return (
        <div className="app-container">
            <Header 
                username={user.username} 
                onLogout={handleLogout} 
            />
            
            <ErrorMessage 
                message={error} 
                onDismiss={() => setError('')} 
            />

            <RoomInvites 
                onInviteAccepted={(room) => {
                    setRooms(prev => [...prev, room]);
                }}
            />

            <div className="main-content">
                <RoomList
                    rooms={rooms}
                    onRoomSelect={handleRoomSelect}
                    onCreateRoom={handleCreateRoom}
                    showCreateRoom={showCreateRoom}
                    newRoomName={newRoomName}
                    setNewRoomName={setNewRoomName}
                    setShowCreateRoom={setShowCreateRoom}
                    onInviteUsers={handleShowInviteUsers}
                    currentUserId={user.id}
                />

                <PrivateChatList
                    privateChats={privateChats}
                    onChatSelect={setActivePrivateChat}
                    onFindUsers={setShowFindUsers}
                    showFindUsers={showFindUsers}
                />
            </div>

            {showFindUsers && (
                <UserSearch
                    onSelectUser={handleStartPrivateChat}
                    onClose={() => setShowFindUsers(false)}
                    buttonText="Start Chat"
                />
            )}

            {showInviteUsers && (
                <UserSearch
                    onSelectUser={handleInviteToRoom}
                    onClose={() => {
                        setShowInviteUsers(false);
                        setActiveInviteRoom(null);
                    }}
                    buttonText="Invite to Room"
                />
            )}
        </div>
    );
}

export default App;
