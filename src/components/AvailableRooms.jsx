import { useState, useEffect } from 'react';

function AvailableRooms({ onJoinRoom, onClose }) {
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadAvailableRooms();
    }, []);

    const loadAvailableRooms = async () => {
        try {
            const response = await fetch('/api/rooms/available', {
                credentials: 'include'
            });
            if (!response.ok) {
                throw new Error('Failed to load available rooms');
            }
            const data = await response.json();
            setRooms(data);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleJoinRoom = async (roomId) => {
        try {
            const response = await fetch(`/api/rooms/${roomId}/join`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to join room');
            }

            const room = await response.json();
            onJoinRoom(room);
            onClose();
        } catch (error) {
            setError(error.message);
        }
    };

    if (loading) {
        return (
            <div className="available-rooms-modal">
                <div className="loading">Loading available rooms...</div>
            </div>
        );
    }

    return (
        <div className="available-rooms-modal">
            <div className="modal-header">
                <h2>Available Rooms</h2>
                <button className="close-button" onClick={onClose}>×</button>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                    <button onClick={() => setError('')}>×</button>
                </div>
            )}

            <div className="available-rooms-list">
                {rooms.length === 0 ? (
                    <div className="no-rooms">
                        No available rooms to join. Why not create one?
                    </div>
                ) : (
                    rooms.map(room => (
                        <div key={room.room_id} className="available-room-item">
                            <div className="room-info">
                                <h3>{room.name}</h3>
                                <p>Created by: {room.created_by.username}</p>
                                <p>{room.member_count} {room.member_count === 1 ? 'member' : 'members'}</p>
                            </div>
                            <button 
                                className="join-button"
                                onClick={() => handleJoinRoom(room.room_id)}
                            >
                                Join Room
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default AvailableRooms;
