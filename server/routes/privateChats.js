import queries from '../db/queries.js';
import { requireAuth } from '../middleware/auth.js';

export default function(app) {
    app.post('/api/private-chats', requireAuth, async (req, res) => {
        try {
            const { userId } = req.body;
            const chatId = await queries.createPrivateChat(req.session.user.id, userId);
            res.json({ id: chatId });
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    app.get('/api/private-chats', requireAuth, async (req, res) => {
        try {
            const chats = await queries.getUserPrivateChats(req.session.user.id);
            res.json(chats);
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    });

    app.get('/api/private-chats/:id/messages', requireAuth, async (req, res) => {
        try {
            const messages = await queries.getPrivateChatMessages(req.params.id);
            res.json(messages);
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    });
}
