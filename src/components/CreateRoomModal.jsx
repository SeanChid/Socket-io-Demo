import { useState } from 'react';
import './styles/Modal.css';

export default function CreateRoomModal({ isOpen, onClose, onCreateRoom }) {
    const [roomName, setRoomName] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!roomName.trim()) {
            setError('Room name cannot be empty');
            return;
        }

        try {
            await onCreateRoom(roomName.trim());
            setRoomName('');
            setError('');
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to create room');
        }
    };

    const handleClose = () => {
        setRoomName('');
        setError('');
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>Create New Room</h2>
                
                <form onSubmit={handleSubmit}>
                    {error && <div className="error-message">{error}</div>}
                    
                    <input
                        type="text"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="Enter room name"
                        autoFocus
                    />
                    
                    <div className="modal-actions">
                        <button type="button" onClick={handleClose}>
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            disabled={!roomName.trim()}
                        >
                            Create Room
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
