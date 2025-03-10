import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom'
import './App.css'
import socket from './socket'
import useUnreadStore from './store/unreadStore'
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

function MainLayout({ user, onLogout, error, onErrorDismiss }) {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [privateChats, setPrivateChats] = useState([]);
    const [showFindUsers, setShowFindUsers] = useState(false);
    const [showInviteUsers, setShowInviteUsers] = useState(false);
    const [activeInviteRoom, setActiveInviteRoom] = useState(null);
    const { updateUnreadCounts } = useUnreadStore();

    useEffect(() => {
        // Load initial data
        const loadInitialData = async () => {
            await Promise.all([
                loadRooms(),
                loadPrivateChats(),
                loadUnreadCounts()
            ]);
        };
        loadInitialData();

        // Set up socket event listeners
        socket.on('unread-counts', updateUnreadCounts);
        socket.on('new-message', handleNewMessage);
        socket.on('connect', () => {
            // Re-fetch unread counts when reconnecting
            socket.emit('get-unread-counts');
        });

        return () => {
            socket.off('unread-counts', updateUnreadCounts);
            socket.off('new-message', handleNewMessage);
            socket.off('connect');
        };
    }, []);

    const loadUnreadCounts = async () => {
        try {
            const response = await fetch('/api/rooms/unread-counts');
            if (!response.ok) {
                if (response.status === 401) return;
                throw new Error('Failed to load unread counts');
            }
            const counts = await response.json();
            updateUnreadCounts(counts);
        } catch (error) {
            console.error('Failed to load unread counts:', error);
        }
    };

    const handleNewMessage = async (message) => {
        // Reload unread counts when receiving new messages
        await loadUnreadCounts();
    };

    const loadRooms = async () => {
        try {
            const response = await fetch('/api/rooms');
            if (!response.ok) {
                if (response.status === 401) return;
                throw new Error('Failed to load rooms');
            }
            const data = await response.json();
            setRooms(data);
        } catch (error) {
            onErrorDismiss('Failed to load rooms');
        }
    };

    const loadPrivateChats = async () => {
        try {
            const response = await fetch('/api/private-chats');
            if (!response.ok) {
                if (response.status === 401) return;
                throw new Error('Failed to load private chats');
            }
            const data = await response.json();
            setPrivateChats(data);
        } catch (error) {
            onErrorDismiss('Failed to load private chats');
        }
    };

    const handleCreateRoom = async (roomName) => {
        try {
            const response = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: roomName.trim() }),
                credentials: 'include'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create room');
            }
            
            const newRoom = await response.json();
            await loadRooms();
            navigate(`/room/${newRoom.room_id}`);
        } catch (error) {
            onErrorDismiss(error.message);
            throw error; // Re-throw for modal error handling
        }
    };

    const handleRoomSelect = async (room) => {
        try {
            const isMember = room.members.some(member => member.id === user.id);
            const isCreator = room.created_by === user.id;
            
            if (!isMember && !isCreator) {
                const response = await fetch(`/api/rooms/${room.room_id}/join`, {
                    method: 'POST',
                    credentials: 'include'
                });

                if (!response.ok) throw new Error('Failed to join room');
                await loadRooms();
            }
            navigate(`/room/${room.room_id}`);
        } catch (error) {
            onErrorDismiss(error.message);
        }
    };

    const handleStartPrivateChat = async (otherUser) => {
        try {
            const response = await fetch('/api/private-chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ otherUserId: otherUser.id }),
                credentials: 'include'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to start private chat');
            }

            const chat = await response.json();
            setShowFindUsers(false);
            await loadPrivateChats();
            navigate(`/private/${chat.chat_id}`);
        } catch (error) {
            onErrorDismiss(error.message);
        }
    };

    const handleInviteToRoom = async (userToInvite) => {
        try {
            const response = await fetch(`/api/rooms/${activeInviteRoom}/invite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userToInvite.id }),
                credentials: 'include'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to invite user');
            }

            setShowInviteUsers(false);
            setActiveInviteRoom(null);
        } catch (error) {
            onErrorDismiss(error.message);
        }
    };

    return (
        <div className="app-container">
            <Header username={user.username} onLogout={onLogout} />
            <ErrorMessage message={error} onDismiss={onErrorDismiss} />
            <RoomInvites onInviteAccepted={loadRooms} />

            <div className="main-content">
                <RoomList
                    rooms={rooms}
                    onRoomSelect={handleRoomSelect}
                    onCreateRoom={handleCreateRoom}
                    onInviteUsers={(room) => {
                        setActiveInviteRoom(room.room_id);
                        setShowInviteUsers(true);
                    }}
                    currentUserId={user.id}
                />

                <PrivateChatList
                    privateChats={privateChats}
                    onChatSelect={(chat) => navigate(`/private/${chat.chat_id}`)}
                    onFindUsers={() => setShowFindUsers(true)}
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

function ChatRoomView({ user, onError }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [room, setRoom] = useState(null);

    useEffect(() => {
        const loadRoom = async () => {
            try {
                const response = await fetch(`/api/rooms/${id}/join`, {
                    method: 'POST',
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to join room');
                }

                const roomData = await response.json();
                setRoom(roomData);
                socket.emit('join-room', id);
            } catch (error) {
                onError(error.message);
                navigate('/');
            }
        };
        loadRoom();
        return () => socket.emit('leave-room', id);
    }, [id]);

    if (!room) return <LoadingSpinner />;

    return (
        <ChatRoom
            room={{
                ...room,
                current_user: {
                    id: user.id,
                    username: user.username
                }
            }}
            onBack={() => navigate('/')}
        />
    );
}

function PrivateChatView({ user }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [chat, setChat] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadChat = async () => {
            try {
                const response = await fetch(`/api/private-chats/${id}`, {
                    credentials: 'include'
                });
                
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Failed to load chat');
                }
                
                const chatData = await response.json();
                setChat(chatData);
            } catch (error) {
                setError(error.message);
                // Wait a moment before navigating back so the user can see the error
                setTimeout(() => navigate('/'), 2000);
            }
        };
        loadChat();
    }, [id, navigate]);

    if (error) {
        return (
            <div className="error-container">
                <div className="error-message">{error}</div>
            </div>
        );
    }

    if (!chat) return <LoadingSpinner />;

    return (
        <PrivateChat
            chat={chat}
            onBack={() => navigate('/')}
            userId={user.id}
        />
    );
}

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        checkSession();
    }, []);

    useEffect(() => {
        if (user) {
            socket.connect();
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

    const checkSession = async () => {
        try {
            const response = await fetch('/api/session');
            const data = await response.json();
            if (data.authenticated) setUser(data.user);
        } catch (error) {
            console.error('Session check failed:', error);
        } finally {
            setLoading(false);
        }
    };

    const setupSocketListeners = () => {
        socket.on('connect', () => console.log('Socket connected'));
        socket.on('connect_error', (error) => {
            if (error.message === 'Unauthorized') {
                setUser(null);
                socket.disconnect();
            }
        });
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            setUser(null);
            socket.disconnect();
        } catch (error) {
            setError('Failed to logout');
        }
    };

    if (loading) return <LoadingSpinner />;
    if (!user) return <Auth onAuth={setUser} />;

    return (
        <BrowserRouter>
            <Routes>
                <Route 
                    path="/" 
                    element={
                        <MainLayout 
                            user={user}
                            onLogout={handleLogout}
                            error={error}
                            onErrorDismiss={() => setError('')}
                        />
                    } 
                />
                <Route 
                    path="/room/:id" 
                    element={
                        <ChatRoomView 
                            user={user}
                            onError={setError}
                        />
                    } 
                />
                <Route 
                    path="/private/:id" 
                    element={
                        <PrivateChatView 
                            user={user}
                            onError={setError}
                        />
                    } 
                />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
