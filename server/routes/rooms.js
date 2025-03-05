import queries from '../db/queries.js';
import { requireAuth } from '../middleware/auth.js';

export default function(app, io) {
    app.post('/api/rooms', requireAuth, async (req, res) => {
        try {
            const { name } = req.body;
            if (!name || name.trim().length === 0) {
                return res.status(400).json({ error: 'Room name is required' });
            }
            
            // Create room as private by default for better security
            const roomId = await queries.createChatRoom(name.trim(), req.session.user.id, true);
            const rooms = await queries.getUserRooms(req.session.user.id);
            const newRoom = rooms.find(r => r.room_id === roomId);
            
            res.json(newRoom);
        } catch (error) {
            console.error('Create room error:', error);
            res.status(500).json({ error: 'Failed to create room' });
        }
    });

    app.get('/api/rooms', requireAuth, async (req, res) => {
        try {
            const rooms = await queries.getUserRooms(req.session.user.id);
            res.json(rooms);
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    // Add endpoint to get room invites
    app.get('/api/rooms/invites', requireAuth, async (req, res) => {
        try {
            const invites = await queries.getRoomInvites(req.session.user.id);
            res.json(invites);
        } catch (error) {
            console.error('Get invites error:', error);
            res.status(500).json({ error: 'Failed to get invites' });
        }
    });

    app.post('/api/rooms/:id/join', requireAuth, async (req, res) => {
        try {
            // Check if user has an invite or is room creator
            const room = await queries.getRoomDetails(req.params.id);
            if (!room) {
                return res.status(404).json({ error: 'Room not found' });
            }

            // Check if user is already a member
            const isMember = await queries.isUserInRoom(req.session.user.id, req.params.id);
            if (isMember) {
                return res.json(room); // Already a member, just return the room
            }

            // Allow room creator to join without invite
            if (room.created_by !== req.session.user.id) {
                // Check for valid invite
                const invites = await queries.getRoomInvites(req.session.user.id);
                const hasInvite = invites.some(invite => 
                    invite.room_id === parseInt(req.params.id) && 
                    invite.status === 'pending'
                );

                if (!hasInvite) {
                    return res.status(403).json({ error: 'You need an invite to join this room' });
                }
            }

            const joinedRoom = await queries.joinRoom(req.session.user.id, req.params.id);
            
            // Notify room members about the new user
            io.to(`room:${req.params.id}`).emit('user-joined-room', {
                roomId: req.params.id,
                user: {
                    id: req.session.user.id,
                    username: req.session.user.username
                }
            });

            res.json(joinedRoom);
        } catch (error) {
            console.error('Join room error:', error);
            res.status(400).json({ error: error.message });
        }
    });

    app.post('/api/rooms/:id/invite', requireAuth, async (req, res) => {
        try {
            const { userId } = req.body;
            const roomId = req.params.id;

            // Check if the inviting user is a member of the room
            const isMember = await queries.isUserInRoom(req.session.user.id, roomId);
            if (!isMember) {
                return res.status(403).json({ error: 'You must be a member of the room to invite others' });
            }

            // Check if the invited user exists
            const invitedUser = await queries.getUserById(userId);
            if (!invitedUser) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Check if user is already in the room
            const isAlreadyMember = await queries.isUserInRoom(userId, roomId);
            if (isAlreadyMember) {
                return res.status(400).json({ error: 'User is already a member of this room' });
            }

            // Create the invitation
            await queries.createRoomInvite(userId, roomId, req.session.user.id);

            // Notify the invited user via socket
            io.to(`user:${userId}`).emit('room-invite', {
                roomId,
                invitedBy: {
                    id: req.session.user.id,
                    username: req.session.user.username
                }
            });

            res.json({ message: 'Invitation sent successfully' });
        } catch (error) {
            console.error('Room invite error:', error);
            res.status(500).json({ error: 'Failed to send invitation' });
        }
    });

    app.get('/api/rooms/:id', requireAuth, async (req, res) => {
        try {
            const room = await queries.getRoomDetails(req.params.id);
            if (!room) {
                return res.status(404).json({ error: 'Room not found' });
            }

            // Check if user is a member or creator
            const isMember = await queries.isUserInRoom(req.session.user.id, req.params.id);
            if (!isMember && room.created_by !== req.session.user.id) {
                return res.status(403).json({ error: 'Not a member of this room' });
            }

            res.json(room);
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    app.get('/api/rooms/:id/messages', requireAuth, async (req, res) => {
        try {
            // Check if user is a member or creator
            const room = await queries.getRoomDetails(req.params.id);
            if (!room) {
                return res.status(404).json({ error: 'Room not found' });
            }

            const isMember = await queries.isUserInRoom(req.session.user.id, req.params.id);
            if (!isMember && room.created_by !== req.session.user.id) {
                return res.status(403).json({ error: 'Not a member of this room' });
            }

            const messages = await queries.getRoomMessages(req.params.id);
            res.json(messages);
        } catch (error) {
            console.error('Get room messages error:', error);
            res.status(500).json({ error: 'Failed to get room messages' });
        }
    });

    // Add endpoint to accept room invites
    app.post('/api/rooms/invites/:inviteId/accept', requireAuth, async (req, res) => {
        try {
            const invite = await queries.respondToInvite(req.params.inviteId, 'accepted');
            if (!invite) {
                return res.status(404).json({ error: 'Invite not found' });
            }

            // Join the room after accepting invite
            const room = await queries.joinRoom(req.session.user.id, invite.room_id);
            
            res.json(room);
        } catch (error) {
            console.error('Accept invite error:', error);
            res.status(500).json({ error: 'Failed to accept invite' });
        }
    });

    // Add endpoint to decline room invites
    app.post('/api/rooms/invites/:inviteId/decline', requireAuth, async (req, res) => {
        try {
            const result = await queries.respondToInvite(req.params.inviteId, 'declined');
            if (!result) {
                return res.status(404).json({ error: 'Invite not found or already responded to' });
            }
            
            res.json({ message: 'Invite declined successfully', invite: result });
        } catch (error) {
            console.error('Decline invite error:', error);
            res.status(500).json({ error: error.message || 'Failed to decline invite' });
        }
    });
}
