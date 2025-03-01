import queries from '../db/queries.js';
import { requireAuth } from '../middleware/auth.js';

export default function(app, io) {
    app.post('/api/rooms', requireAuth, async (req, res) => {
        try {
            const { name } = req.body;
            if (!name || name.trim().length === 0) {
                return res.status(400).json({ error: 'Room name is required' });
            }
            
            // Create room as public by default
            const roomId = await queries.createChatRoom(name.trim(), req.session.user.id, false);
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

    app.post('/api/rooms/:id/join', requireAuth, async (req, res) => {
        try {
            const room = await queries.joinRoom(req.session.user.id, req.params.id);
            
            // Notify room members about the new user
            io.to(`room:${req.params.id}`).emit('user-joined-room', {
                roomId: req.params.id,
                user: {
                    id: req.session.user.id,
                    username: req.session.user.username
                }
            });

            res.json(room);
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
            const room = await queries.getRoomById(req.params.id);
            if (!room) {
                return res.status(404).json({ error: 'Room not found' });
            }

            // Check if user is a member
            const isMember = await queries.isUserInRoom(req.session.user.id, req.params.id);
            if (!isMember) {
                return res.status(403).json({ error: 'Not a member of this room' });
            }

            res.json(room);
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    app.get('/api/rooms/:id/messages', requireAuth, async (req, res) => {
        try {
            // Check if user is a member
            const isMember = await queries.isUserInRoom(req.session.user.id, req.params.id);
            if (!isMember) {
                return res.status(403).json({ error: 'Not a member of this room' });
            }

            const messages = await queries.getRoomMessages(req.params.id);
            res.json(messages);
        } catch (error) {
            console.error('Get room messages error:', error);
            res.status(500).json({ error: 'Failed to get room messages' });
        }
    });
}
