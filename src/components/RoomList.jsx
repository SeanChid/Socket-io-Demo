import { useState } from 'react';
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
    const { getUnreadCount } = useUnreadStore();

    const handleCreateRoom = async (roomName) => {
        try {
            await onCreateRoom(roomName);
            setShowCreateRoom(false);
            setError('');
        } catch (error) {
            setError(error.message);
        }
    };

    const handleInviteClick = (e, room) => {
        e.stopPropagation();
        onInviteUsers(room);
    };

    const handleRoomClick = (room) => {
        // Don't trigger room selection if we're already in this room
        if (selectedRoom?.room_id === room.room_id) return;
        onRoomSelect(room);
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
                {rooms.map(room => {
                    const unreadCount = getUnreadCount(room.room_id, true);
                    return (
                        <div 
                            key={room.room_id} 
                            className={`room-item ${selectedRoom?.room_id === room.room_id ? 'selected' : ''}`}
                        >
                            <div className="room-info" onClick={() => handleRoomClick(room)}>
                                <div className="room-name">
                                    {room.name}
                                    {room.is_private && <span className="private-badge">Private</span>}
                                    {unreadCount > 0 && <UnreadBadge count={unreadCount} />}
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
                    );
                })}
                {rooms.length === 0 && (
                    <div className="no-rooms">
                        <p>No rooms available</p>
                        <p>Create a new room to get started!</p>
                    </div>
                )}
            </div>

            <CreateRoomModal 
                isOpen={showCreateRoom}
                onClose={() => {
                    setShowCreateRoom(false);
                    setError('');
                }}
                onCreateRoom={handleCreateRoom}
            />
        </div>
    );
}
