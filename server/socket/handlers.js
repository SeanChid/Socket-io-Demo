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
        } catch (error) {
            socket.emit('error', { message: 'Failed to join room' });
        }
    });

    // Leave room
    socket.on('leave-room', (roomId) => {
        socket.leave(`room:${roomId}`);
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

            socket.join(`private:${chatId}`);
            socket.emit('private-chat-joined', { chatId });
        } catch (error) {
            console.error('Error joining private chat:', error);
            socket.emit('error', { message: 'Failed to join private chat' });
        }
    });

    // Leave private chat
    socket.on('leave-private-chat', (chatId) => {
        socket.leave(`private:${chatId}`);
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

            // Send notification to everyone not in the room
            socket.broadcast.emit('message-notification', {
                type: 'room',
                roomId,
                sender: messageData.sender,
                content: messageData.content
            });
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

            // Send notification to the other user if they're not in this chat
            socket.broadcast.emit('message-notification', {
                type: 'private',
                chatId,
                sender: messageData.sender,
                content: messageData.content
            });
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
