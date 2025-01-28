import queries from '../db/queries.js';
import { requireAuth } from '../middleware/auth.js';

export default function(app, io) {
    app.post('/api/rooms', requireAuth, async (req, res) => {
        try {
            const { name, isPrivate } = req.body;
            if (!name || name.trim().length === 0) {
                return res.status(400).json({ error: 'Room name is required' });
            }
            
            const roomId = await queries.createChatRoom(name.trim(), req.session.user.id, isPrivate);
            const room = await queries.getUserRooms(req.session.user.id);
            const newRoom = room.find(r => r.room_id === roomId);
            
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

    app.get('/api/rooms/available', requireAuth, async (req, res) => {
        try {
            const rooms = await queries.getAvailableRooms(req.session.user.id);
            res.json(rooms);
        } catch (error) {
            console.error('Get available rooms error:', error);
            res.status(500).json({ error: 'Failed to get available rooms' });
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
            const invite = await queries.inviteToRoom(req.params.id, req.session.user.id, userId);
            res.json(invite);
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    });
}
