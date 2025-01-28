function RoomList({ rooms, onRoomSelect, onCreateRoom, showCreateRoom, newRoomName, setNewRoomName, setShowCreateRoom }) {
    const handleCreateRoom = (e) => {
        e.preventDefault();
        if (!newRoomName.trim()) return;
        onCreateRoom(newRoomName.trim());
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
                        pattern="[A-Za-z0-9\s-]+"
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
                        No chat rooms available. Create one to get started!
                    </div>
                ) : (
                    rooms.map(room => (
                        <div 
                            key={room.room_id} 
                            className="room-item"
                            onClick={() => onRoomSelect(room)}
                        >
                            <span className="room-name">{room.name}</span>
                            <span className="member-count">
                                {room.members.length} {room.members.length === 1 ? 'member' : 'members'}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default RoomList;
