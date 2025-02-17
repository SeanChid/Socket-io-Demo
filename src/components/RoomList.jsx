import './styles/Room.css';

function RoomList({ 
    rooms, 
    onRoomSelect, 
    onCreateRoom, 
    showCreateRoom, 
    newRoomName, 
    setNewRoomName, 
    setShowCreateRoom,
    onInviteUsers,
    currentUserId
}) {
    const handleCreateRoom = (e) => {
        e.preventDefault();
        if (!newRoomName.trim()) return;
        onCreateRoom(newRoomName.trim());
    };

    const handleInviteClick = (e, room) => {
        e.stopPropagation(); // Prevent room selection when clicking invite
        onInviteUsers(room);
    };

    return (
        <div className="rooms-section">
            <div className="section-header">
                <h2>Chat Rooms</h2>
                <button 
                    className="create-button"
                    onClick={() => setShowCreateRoom(true)}
                >
                    Create Room
                </button>
            </div>

            {showCreateRoom && (
                <form className="create-room-form" onSubmit={handleCreateRoom}>
                    <input
                        type="text"
                        className="room-name-input"
                        value={newRoomName}
                        onChange={(e) => setNewRoomName(e.target.value)}
                        placeholder="Enter room name"
                        required
                        minLength={3}
                        maxLength={50}
                        pattern="[A-Za-z0-9\s\-]+"
                        title="Room name can only contain letters, numbers, spaces, and hyphens"
                    />
                    <div className="form-buttons">
                        <button type="submit" className="create-button">
                            Create
                        </button>
                        <button 
                            type="button" 
                            className="cancel-button"
                            onClick={() => {
                                setShowCreateRoom(false);
                                setNewRoomName('');
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            <div className="room-list">
                {rooms.length === 0 ? (
                    <div className="no-rooms">
                        <p>No chat rooms available.</p>
                        <p>Create a room to get started!</p>
                    </div>
                ) : (
                    rooms.map(room => (
                        <div 
                            key={room.room_id} 
                            className="room-item"
                            onClick={() => onRoomSelect(room)}
                        >
                            <div className="room-info">
                                <span className="room-name">{room.name}</span>
                                <span className="member-count">
                                    {room.members.length} {room.members.length === 1 ? 'member' : 'members'}
                                </span>
                            </div>
                            {room.created_by === currentUserId && (
                                <button
                                    className="invite-button"
                                    onClick={(e) => handleInviteClick(e, room)}
                                >
                                    Invite Users
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default RoomList;
