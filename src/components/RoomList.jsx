import { useState, useEffect } from 'react';
import socket from '../socket';
import useUnreadStore from '../store/unreadStore';
import UnreadBadge from './UnreadBadge';
import CreateRoomModal from './CreateRoomModal';
import './styles/Room.css';

export default function RoomList({ 
    rooms, 
    onRoomSelect,
    selectedRoom, 
    onCreateRoom,
    onInviteUsers,
    currentUserId 
}) {
    const [error, setError] = useState('');
    const [showCreateRoom, setShowCreateRoom] = useState(false);
    const { getUnreadCount, incrementUnread, clearUnread } = useUnreadStore();

    useEffect(() => {
        // Clear unread count when room is selected
        if (selectedRoom) {
            clearUnread(selectedRoom.room_id, true);
        }
    }, [selectedRoom, clearUnread]);

    useEffect(() => {
        // Listen for new messages to update unread counts
        const handleNewMessage = (message) => {
            // Only increment if message is for a room and we're not in that room
            if (message.roomId && (!selectedRoom || message.roomId !== selectedRoom.room_id)) {
                incrementUnread(message.roomId, true);
            }
        };

        socket.on('new-message', handleNewMessage);

        return () => {
            socket.off('new-message', handleNewMessage);
        };
    }, [selectedRoom, incrementUnread]);

    const handleCreateRoom = async (roomName) => {
        try {
            await onCreateRoom(roomName);
            setShowCreateRoom(false);
        } catch (error) {
            setError(error.message);
        }
    };

    const handleInviteClick = (e, room) => {
        e.stopPropagation();
        onInviteUsers(room);
    };

    return (
        <div className="rooms-section">
            <div className="section-header">
                <h2>Chat Rooms</h2>
                <button 
                    className="create-room-button"
                    onClick={() => setShowCreateRoom(true)}
                >
                    Create Room
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="room-list">
                {rooms.map(room => (
                    <div 
                        key={room.room_id} 
                        className={`room-item ${selectedRoom?.room_id === room.room_id ? 'selected' : ''}`}
                    >
                        <div className="room-info" onClick={() => onRoomSelect(room)}>
                            <div className="room-name">
                                {room.name}
                                <UnreadBadge count={getUnreadCount(room.room_id, true)} />
                            </div>
                            <div className="room-members">
                                {room.members.length} member{room.members.length !== 1 ? 's' : ''}
                            </div>
                        </div>
                        {room.created_by === currentUserId && (
                            <div className="room-actions">
                                <button 
                                    onClick={(e) => handleInviteClick(e, room)}
                                    className="invite-button"
                                >
                                    Invite
                                </button>
                            </div>
                        )}
                    </div>
                ))}
                {rooms.length === 0 && (
                    <div className="no-rooms">
                        <p>No rooms available</p>
                        <p>Create a new room to get started!</p>
                    </div>
                )}
            </div>

            <CreateRoomModal 
                isOpen={showCreateRoom}
                onClose={() => setShowCreateRoom(false)}
                onCreateRoom={handleCreateRoom}
            />
        </div>
    );
}
