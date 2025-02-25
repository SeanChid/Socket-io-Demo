import queries from '../db/queries.js';

export default function(io, socket) {
    // Join room
    socket.on('join-room', async (roomId) => {
        try {
            // Verify room membership
            const isMember = await queries.isUserInRoom(socket.user.id, roomId);
            if (!isMember) {
                socket.emit('error', { message: 'Not a member of this room' });
                return;
            }
            socket.join(`room:${roomId}`);
            socket.to(`room:${roomId}`).emit('user-joined', { 
                userId: socket.user.id, 
                username: socket.user.username 
            });
        } catch (error) {
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    // Leave room
    socket.on('leave-room', (roomId) => {
        socket.leave(`room:${roomId}`);
        socket.to(`room:${roomId}`).emit('user-left', { 
            userId: socket.user.id, 
            username: socket.user.username 
        });
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

            // Leave any previous private chats
            for (const room of socket.rooms) {
                if (room.startsWith('private:')) {
                    socket.leave(room);
                }
            }

            // Join the new private chat room
            const roomName = `private:${chatId}`;
            socket.join(roomName);

            // Emit success event
            socket.emit('private-chat-joined', { chatId });
        } catch (error) {
            console.error('Error joining private chat:', error);
            socket.emit('error', { message: 'Failed to join private chat' });
        }
    });

    // Leave private chat
    socket.on('leave-private-chat', (chatId) => {
        const roomName = `private:${chatId}`;
        socket.leave(roomName);
        socket.to(roomName).emit('user-left-private-chat', { 
            userId: socket.user.id, 
            username: socket.user.username 
        });
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
            io.to(`room:${roomId}`).emit('new-message', message);
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

            // Verify chat membership
            const isMember = await queries.isUserInPrivateChat(socket.user.id, chatId);
            if (!isMember) {
                socket.emit('error', { message: 'Not a member of this chat' });
                return;
            }

            const message = await queries.addMessage(content, socket.user.id, null, chatId);
            const messageWithChatId = { ...message, chat_id: chatId };
            io.to(`private:${chatId}`).emit('new-message', messageWithChatId);
        } catch (error) {
            console.error('Error sending private message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.user.username);
        // Notify others that user is offline
        socket.broadcast.emit('user-offline', { 
            userId: socket.user.id, 
            username: socket.user.username 
        });
    });
}
