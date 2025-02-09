import { useState, useEffect } from 'react';

function RoomInvites({ onInviteAccepted }) {
    const [invites, setInvites] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        loadInvites();
        
        // Set up periodic refresh
        const refreshInterval = setInterval(loadInvites, 10000); // Check every 10 seconds
        
        return () => clearInterval(refreshInterval);
    }, []);

    const loadInvites = async () => {
        try {
            const response = await fetch('/api/invites', {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Failed to load invites');
            const data = await response.json();
            setInvites(data);
        } catch (error) {
            setError('Failed to load invites');
        }
    };

    const handleInviteResponse = async (inviteId, status) => {
        try {
            const response = await fetch(`/api/invites/${inviteId}/respond`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status }),
                credentials: 'include'
            });

            if (!response.ok) throw new Error('Failed to respond to invite');
            
            if (status === 'accepted') {
                const data = await response.json();
                onInviteAccepted(data);
            }
            
            // Refresh invites list
            loadInvites();
        } catch (error) {
            setError('Failed to respond to invite');
        }
    };

    if (invites.length === 0) return null;

    return (
        <div className="room-invites">
            <h3>Room Invites</h3>
            {error && <div className="error-message">{error}</div>}
            <div className="invite-list">
                {invites.map(invite => (
                    <div key={invite.invite_id} className="invite-item">
                        <span>
                            Invited to join "{invite.room_name}" by {invite.inviter_username}
                        </span>
                        <div className="invite-actions">
                            <button
                                onClick={() => handleInviteResponse(invite.invite_id, 'accepted')}
                                className="accept-button"
                            >
                                Accept
                            </button>
                            <button
                                onClick={() => handleInviteResponse(invite.invite_id, 'rejected')}
                                className="reject-button"
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default RoomInvites; 
