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

    app.get('/api/rooms/:id/messages', requireAuth, async (req, res) => {
        try {
            const messages = await queries.getRoomMessages(req.params.id);
            res.json(messages);
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    app.post('/api/rooms/:id/invites', requireAuth, async (req, res) => {
        try {
            const { userId } = req.body;
            
            // Check if user is the room creator
            const room = await queries.getRoomDetails(req.params.id);
            if (room.created_by !== req.session.user.id) {
                return res.status(403).json({ error: 'Only room creator can send invites' });
            }

            // Check if user is already in the room
            const isMember = await queries.isUserInRoom(userId, req.params.id);
            if (isMember) {
                return res.status(400).json({ error: 'User is already a member of this room' });
            }

            const invite = await queries.inviteToRoom(req.params.id, req.session.user.id, userId);
            res.json(invite);
        } catch (error) {
            console.error('Room invite error:', error);
            res.status(500).json({ error: 'Failed to send invite' });
        }
    });
}
