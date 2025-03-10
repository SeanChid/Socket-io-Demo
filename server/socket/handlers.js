import queries from '../db/queries.js';

// Track which rooms/chats users are actively viewing
const activeUsers = new Map(); // userId -> { roomId, privateChatId }

export default function(io, socket) {
    // Join user's personal room for notifications
    socket.join(`user:${socket.user.id}`);

    // Track user's active room/chat
    activeUsers.set(socket.user.id, { roomId: null, privateChatId: null });

    // Join room
    socket.on('join-room', async (roomId) => {
        try {
            // Verify room membership
            const isMember = await queries.isUserInRoom(socket.user.id, roomId);
            if (!isMember) {
                socket.emit('error', { message: 'Not a member of this room' });
                return;
            }

            // Update active room
            const userState = activeUsers.get(socket.user.id);
            userState.roomId = roomId;
            userState.privateChatId = null;
            activeUsers.set(socket.user.id, userState);

            socket.join(`room:${roomId}`);

            // Get messages and mark notifications as read
            const messages = await queries.getRoomMessages(roomId, socket.user.id);
            socket.emit('room-messages', { roomId, messages });

            // Get updated unread counts for all rooms/chats
            const unreadCounts = await queries.getUnreadCounts(socket.user.id);
            socket.emit('unread-counts', unreadCounts);
        } catch (error) {
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    // Leave room
    socket.on('leave-room', async (roomId) => {
        socket.leave(`room:${roomId}`);
        
        // Clear active room
        const userState = activeUsers.get(socket.user.id);
        userState.roomId = null;
        activeUsers.set(socket.user.id, userState);

        // Get updated unread counts
        const unreadCounts = await queries.getUnreadCounts(socket.user.id);
        socket.emit('unread-counts', unreadCounts);
    });

    // Join private chat
    socket.on('join-private-chat', async (chatId) => {
        try {
            if (!socket.user) {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }

            // Verify chat membership
            const isMember = await queries.isUserInPrivateChat(socket.user.id, chatId);
            if (!isMember) {
                socket.emit('error', { message: 'Not a member of this chat' });
                return;
            }

            // Update active chat
            const userState = activeUsers.get(socket.user.id);
            userState.privateChatId = chatId;
            userState.roomId = null;
            activeUsers.set(socket.user.id, userState);

            socket.join(`private:${chatId}`);

            // Get messages and mark notifications as read
            const messages = await queries.getPrivateChatMessages(chatId, socket.user.id);
            socket.emit('private-chat-messages', { chatId, messages });

            // Get updated unread counts for all rooms/chats
            const unreadCounts = await queries.getUnreadCounts(socket.user.id);
            socket.emit('unread-counts', unreadCounts);
        } catch (error) {
            console.error('Error joining private chat:', error);
            socket.emit('error', { message: 'Failed to join private chat' });
        }
    });

    // Leave private chat
    socket.on('leave-private-chat', async (chatId) => {
        socket.leave(`private:${chatId}`);
        
        // Clear active chat
        const userState = activeUsers.get(socket.user.id);
        userState.privateChatId = null;
        activeUsers.set(socket.user.id, userState);

        // Get updated unread counts
        const unreadCounts = await queries.getUnreadCounts(socket.user.id);
        socket.emit('unread-counts', unreadCounts);
    });

    // Send room invite
    socket.on('send-room-invite', async ({ userId, roomId }) => {
        try {
            const room = await queries.getRoomDetails(roomId);
            socket.to(`user:${userId}`).emit('room-invite', {
                roomId: room.room_id,
                roomName: room.name,
                inviterUsername: socket.user.username
            });
        } catch (error) {
            socket.emit('error', { message: 'Failed to send invite' });
        }
    });

    // Send message to room
    socket.on('send-room-message', async ({ roomId, content }) => {
        try {
            if (!socket.user) {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }

            // Verify room membership
            const isMember = await queries.isUserInRoom(socket.user.id, roomId);
            if (!isMember) {
                socket.emit('error', { message: 'Not a member of this room' });
                return;
            }

            const message = await queries.addMessage(content, socket.user.id, roomId);
            const messageData = {
                ...message,
                roomId,
                sender: {
                    id: socket.user.id,
                    username: socket.user.username
                }
            };

            // Send to everyone in the room including sender
            io.to(`room:${roomId}`).emit('new-message', messageData);

            // Get all room members to update their unread counts
            const roomDetails = await queries.getRoomDetails(roomId);
            const memberIds = roomDetails.members.map(m => m.id);

            // For each member not actively viewing the room, send them updated unread counts
            for (const memberId of memberIds) {
                const userState = activeUsers.get(memberId);
                if (!userState || userState.roomId !== roomId) {
                    const unreadCounts = await queries.getUnreadCounts(memberId);
                    io.to(`user:${memberId}`).emit('unread-counts', unreadCounts);
                }
            }
        } catch (error) {
            console.error('Error sending room message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Send private message
    socket.on('send-private-message', async ({ chatId, content }) => {
        try {
            if (!socket.user) {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }

            const isMember = await queries.isUserInPrivateChat(socket.user.id, chatId);
            if (!isMember) {
                socket.emit('error', { message: 'Not a member of this chat' });
                return;
            }

            const message = await queries.addMessage(content, socket.user.id, null, chatId);
            const messageData = {
                ...message,
                privateChatId: chatId,
                sender: {
                    id: socket.user.id,
                    username: socket.user.username
                }
            };

            // Send to everyone in the private chat including sender
            io.to(`private:${chatId}`).emit('new-message', messageData);

            // Get the other user's ID to update their unread counts
            const chat = await queries.getPrivateChatDetails(chatId);
            const otherUserId = chat.user1_id === socket.user.id ? chat.user2_id : chat.user1_id;

            // Only send unread counts if the other user isn't actively viewing this chat
            const userState = activeUsers.get(otherUserId);
            if (!userState || userState.privateChatId !== chatId) {
                const unreadCounts = await queries.getUnreadCounts(otherUserId);
                io.to(`user:${otherUserId}`).emit('unread-counts', unreadCounts);
            }
        } catch (error) {
            console.error('Error sending private message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Get initial unread counts when connecting
    socket.on('get-unread-counts', async () => {
        try {
            const unreadCounts = await queries.getUnreadCounts(socket.user.id);
            socket.emit('unread-counts', unreadCounts);
        } catch (error) {
            console.error('Error getting unread counts:', error);
            socket.emit('error', { message: 'Failed to get unread counts' });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        // Remove user from active tracking
        activeUsers.delete(socket.user.id);
        
        console.log('User disconnected:', socket.user.username);
        // Notify others that user is offline
        socket.broadcast.emit('user-offline', { 
            userId: socket.user.id, 
            username: socket.user.username 
        });
    });
}
