import queries from '../db/queries.js';
import { requireAuth } from '../middleware/auth.js';

export default function(app) {
    app.post('/api/private-chats', requireAuth, async (req, res) => {
        try {
            const { userId } = req.body;
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }

            // Check if chat already exists
            const existingChats = await queries.getUserPrivateChats(req.session.user.id);
            const existingChat = existingChats.find(chat => 
                chat.other_user.id === userId
            );

            if (existingChat) {
                return res.json(existingChat);
            }

            // Create new chat
            const chatId = await queries.createPrivateChat(req.session.user.id, userId);
            const updatedChats = await queries.getUserPrivateChats(req.session.user.id);
            const newChat = updatedChats.find(chat => chat.chat_id === chatId);
            
            res.json(newChat);
        } catch (error) {
            console.error('Create private chat error:', error);
            res.status(500).json({ error: 'Failed to create private chat' });
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
