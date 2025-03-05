import { useState, useEffect } from 'react';
import socket from '../socket';
import './styles/RoomInvites.css';

export default function RoomInvites({ onInviteAccepted }) {
    const [invites, setInvites] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState({});

    useEffect(() => {
        loadInvites();

        // Listen for new invites
        socket.on('room-invite', (data) => {
            loadInvites();
        });

        return () => {
            socket.off('room-invite');
        };
    }, []);

    const loadInvites = async () => {
        try {
            const response = await fetch('/api/rooms/invites', {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to load invites');
            const data = await response.json();
            setInvites(data);
        } catch (error) {
            setError(error.message);
        }
    };

    const handleAcceptInvite = async (inviteId, roomId) => {
        setLoading(prev => ({ ...prev, [inviteId]: true }));
        setError('');
        try {
            const response = await fetch(`/api/rooms/invites/${inviteId}/accept`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to accept invite');
            }

            // Remove the accepted invite from the list
            setInvites(invites.filter(invite => invite.invite_id !== inviteId));
            
            // Notify parent component
            onInviteAccepted();
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(prev => ({ ...prev, [inviteId]: false }));
        }
    };

    const handleDeclineInvite = async (inviteId) => {
        setLoading(prev => ({ ...prev, [inviteId]: true }));
        setError('');
        try {
            const response = await fetch(`/api/rooms/invites/${inviteId}/decline`, {
                method: 'POST',
                credentials: 'include'
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to decline invite');
            }

            // Remove the declined invite from the list
            setInvites(invites.filter(invite => invite.invite_id !== inviteId));
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(prev => ({ ...prev, [inviteId]: false }));
        }
    };

    return (
        <div className="room-invites-container">
            <div className="room-invites-header">
                <h3>Room Invites</h3>
                {invites.length > 0 && <span className="invite-count">{invites.length}</span>}
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            <div className="room-invites-content">
                {invites.length > 0 ? (
                    <div className="invite-list">
                        {invites.map(invite => (
                            <div key={invite.invite_id} className="invite-item">
                                <div className="invite-info">
                                    <div className="room-name">{invite.room_name}</div>
                                    <div className="invited-by">Invited by {invite.invited_by_username}</div>
                                </div>
                                <div className="invite-actions">
                                    <button 
                                        onClick={() => handleAcceptInvite(invite.invite_id, invite.room_id)}
                                        className="accept-button"
                                        disabled={loading[invite.invite_id]}
                                    >
                                        {loading[invite.invite_id] ? 'Joining...' : 'Join Room'}
                                    </button>
                                    <button 
                                        onClick={() => handleDeclineInvite(invite.invite_id)}
                                        className="decline-button"
                                        disabled={loading[invite.invite_id]}
                                    >
                                        {loading[invite.invite_id] ? 'Declining...' : 'Decline'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-invites">
                        <p>No pending invites</p>
                    </div>
                )}
            </div>
        </div>
    );
}
