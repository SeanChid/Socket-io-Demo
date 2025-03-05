import { useState, useEffect } from 'react';
import socket from '../socket';
import useUnreadStore from '../store/unreadStore';
import UnreadBadge from './UnreadBadge';
import './styles/Room.css';

function RoomList({ 
    rooms, 
    onRoomSelect, 
    selectedRoom, 
    newRoomName, 
    setNewRoomName, 
    onCreateRoom, 
    onInviteUsers,
    currentUserId
}) {
    const [error, setError] = useState('');
    const { getUnreadCount, clearUnread, incrementUnread } = useUnreadStore();

    useEffect(() => {
        // Listen for new messages to update unread counts
        const handleNewMessage = (message) => {
            // Only increment if message is for a room and we're not in that room
            if (message.roomId && (!selectedRoom || message.roomId !== selectedRoom.room_id)) {
                incrementUnread(message.roomId, true);
            }
        };

        const handleNotification = (notification) => {
            // Only increment if notification is for a room and we're not in that room
            if (notification.type === 'room' && (!selectedRoom || notification.roomId !== selectedRoom.room_id)) {
                incrementUnread(notification.roomId, true);
            }
        };

        socket.on('new-message', handleNewMessage);
        socket.on('message-notification', handleNotification);

        return () => {
            socket.off('new-message', handleNewMessage);
            socket.off('message-notification', handleNotification);
        };
    }, [selectedRoom, incrementUnread]);

    const handleCreateRoom = (e) => {
        e.preventDefault();
        onCreateRoom();
    };

    const handleInviteClick = (e, room) => {
        e.stopPropagation(); // Prevent room selection when clicking invite
        onInviteUsers(room);
    };

    const handleRoomClick = (room) => {
        onRoomSelect(room);
    };

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="rooms-section">
            <div className="section-header">
                <h2>Your Rooms</h2>
            </div>

            <div className="room-list">
                {rooms.length === 0 ? (
                    <div className="no-rooms">
                        <p>No rooms joined yet.</p>
                        <p>Create a room to get started!</p>
                    </div>
                ) : (
                    rooms.map(room => (
                        <div 
                            key={room.room_id} 
                            className={`room-item ${selectedRoom?.room_id === room.room_id ? 'selected' : ''}`}
                            onClick={() => handleRoomClick(room)}
                        >
                            <div className="room-info">
                                <span className="room-name">{room.name}</span>
                                <span className="member-count">
                                    {room.members.length} {room.members.length === 1 ? 'member' : 'members'}
                                </span>
                            </div>
                            <div className="room-actions">
                                <UnreadBadge count={getUnreadCount(room.room_id, true)} />
                                {room.created_by === currentUserId && (
                                    <button onClick={(e) => {
                                        e.stopPropagation();
                                        onInviteUsers(room);
                                    }}>
                                        Invite
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <form className="create-room-form" onSubmit={(e) => {
                e.preventDefault();
                if (newRoomName.trim()) {
                    onCreateRoom();
                }
            }}>
                <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="New room name..."
                />
                <button type="submit" disabled={!newRoomName.trim()}>Create Room</button>
            </form>
        </div>
    );
}

export default RoomList;
