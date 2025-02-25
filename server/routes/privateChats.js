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

    // Add endpoint to get a specific private chat
    app.get('/api/private-chats/:id', requireAuth, async (req, res) => {
        try {
            const chatId = req.params.id;
            
            // Check if user is a member of this chat
            const isMember = await queries.isUserInPrivateChat(req.session.user.id, chatId);
            if (!isMember) {
                return res.status(403).json({ error: 'Not a member of this chat' });
            }

            // Get all user's chats and find the specific one
            const chats = await queries.getUserPrivateChats(req.session.user.id);
            const chat = chats.find(c => c.chat_id === parseInt(chatId));
            
            if (!chat) {
                return res.status(404).json({ error: 'Chat not found' });
            }

            res.json(chat);
        } catch (error) {
            console.error('Get private chat error:', error);
            res.status(500).json({ error: 'Failed to load chat' });
        }
    });

    app.get('/api/private-chats/:id/messages', requireAuth, async (req, res) => {
        try {
            const chatId = req.params.id;
            
            // Check if user is a member of this chat
            const isMember = await queries.isUserInPrivateChat(req.session.user.id, chatId);
            if (!isMember) {
                return res.status(403).json({ error: 'Not a member of this chat' });
            }

            const messages = await queries.getPrivateChatMessages(chatId);
            res.json(messages);
        } catch (error) {
            console.error('Get private chat messages error:', error);
            res.status(500).json({ error: 'Failed to load messages' });
        }
    });
}
