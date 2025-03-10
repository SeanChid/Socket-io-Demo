import pool from './config.js';
import bcrypt from 'bcrypt';

const queries = {
    // User operations
    async createUser(username, password, email) {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3) RETURNING user_id, username, email',
            [username, hashedPassword, email]
        );
        return result.rows[0];
    },

    async verifyUser(username, password) {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) return null;
        
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return null;

        return {
            id: user.user_id,
            username: user.username
        };
    },

    async findUsers(searchTerm) {
        const result = await pool.query(
            'SELECT user_id as id, username, COALESCE(avatar_url, \'\') as avatar_url FROM users WHERE username ILIKE $1',
            [`%${searchTerm}%`]
        );
        return result.rows;
    },

    // Chat room operations
    async createChatRoom(name, createdBy, isPrivate = false) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const roomResult = await client.query(
                'INSERT INTO chat_rooms (name, created_by, is_private) VALUES ($1, $2, $3) RETURNING room_id',
                [name, createdBy, isPrivate]
            );
            const roomId = roomResult.rows[0].room_id;

            // Add creator to room
            await client.query(
                'INSERT INTO user_rooms (user_id, room_id) VALUES ($1, $2)',
                [createdBy, roomId]
            );

            await client.query('COMMIT');
            return roomId;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    async getUserRooms(userId) {
        const result = await pool.query(`
            SELECT 
                r.room_id, r.name, r.is_private, r.created_at, r.created_by,
                array_agg(json_build_object(
                    'id', u.user_id, 
                    'username', u.username, 
                    'avatar_url', COALESCE(u.avatar_url, '')
                )) as members,
                (
                    SELECT COUNT(*)
                    FROM notifications n
                    WHERE n.user_id = $1 
                    AND n.room_id = r.room_id 
                    AND n.is_read = false
                ) as unread_count
            FROM chat_rooms r
            JOIN user_rooms ur ON r.room_id = ur.room_id
            JOIN users u ON ur.user_id = u.user_id
            WHERE r.room_id IN (
                SELECT room_id FROM user_rooms WHERE user_id = $1
            )
            GROUP BY r.room_id, r.name, r.is_private, r.created_at, r.created_by
            ORDER BY r.created_at DESC
        `, [userId]);
        return result.rows;
    },

    async createPrivateChat(user1Id, user2Id) {
        const result = await pool.query(
            'INSERT INTO private_chats (user1_id, user2_id) VALUES ($1, $2) RETURNING chat_id',
            [user1Id, user2Id]
        );
        return result.rows[0].chat_id;
    },

    async getUserPrivateChats(userId) {
        const result = await pool.query(`
            SELECT 
                pc.chat_id,
                pc.created_at,
                CASE 
                    WHEN pc.user1_id = $1 THEN json_build_object(
                        'id', u2.user_id, 
                        'username', u2.username, 
                        'avatar_url', COALESCE(u2.avatar_url, '')
                    )
                    ELSE json_build_object(
                        'id', u1.user_id, 
                        'username', u1.username, 
                        'avatar_url', COALESCE(u1.avatar_url, '')
                    )
                END as other_user,
                (
                    SELECT COUNT(*)
                    FROM notifications n
                    WHERE n.user_id = $1 
                    AND n.private_chat_id = pc.chat_id 
                    AND n.is_read = false
                ) as unread_count
            FROM private_chats pc
            JOIN users u1 ON pc.user1_id = u1.user_id
            JOIN users u2 ON pc.user2_id = u2.user_id
            WHERE pc.user1_id = $1 OR pc.user2_id = $1
            ORDER BY pc.created_at DESC
        `, [userId]);
        return result.rows;
    },

    async addMessage(content, senderId, roomId = null, privateChatId = null) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Insert the message
            const messageResult = await client.query(`
                WITH new_message AS (
                    INSERT INTO chat_messages (content, sender_id, room_id, private_chat_id) 
                    VALUES ($1, $2, $3, $4) 
                    RETURNING *
                )
                SELECT 
                    m.message_id,
                    m.content,
                    m.created_at,
                    json_build_object('id', u.user_id, 'username', u.username, 'avatar_url', u.avatar_url) as sender
                FROM new_message m
                JOIN users u ON m.sender_id = u.user_id
            `, [content, senderId, roomId, privateChatId]);

            const message = messageResult.rows[0];

            // Create notifications for all users in the room/chat except the sender
            if (roomId) {
                // Get users currently in the room
                const activeUsers = await client.query(`
                    SELECT DISTINCT user_id 
                    FROM user_rooms ur
                    WHERE ur.room_id = $1 AND ur.user_id != $2
                `, [roomId, senderId]);

                // Create notifications only for users not currently in the room
                for (const row of activeUsers.rows) {
                    await client.query(`
                        INSERT INTO notifications (user_id, message_id, room_id, is_read)
                        VALUES ($1, $2, $3, false)
                    `, [row.user_id, message.message_id, roomId]);
                }
            } else if (privateChatId) {
                // Get the other user in the private chat
                const otherUser = await client.query(`
                    SELECT 
                        CASE 
                            WHEN user1_id = $1 THEN user2_id 
                            ELSE user1_id 
                        END as user_id
                    FROM private_chats
                    WHERE chat_id = $2
                `, [senderId, privateChatId]);

                if (otherUser.rows.length > 0) {
                    await client.query(`
                        INSERT INTO notifications (user_id, message_id, private_chat_id, is_read)
                        VALUES ($1, $2, $3, false)
                    `, [otherUser.rows[0].user_id, message.message_id, privateChatId]);
                }
            }

            await client.query('COMMIT');
            return message;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    async getRoomMessages(roomId, userId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get messages
            const messagesResult = await client.query(`
                SELECT 
                    m.message_id,
                    m.content,
                    m.created_at,
                    json_build_object('id', u.user_id, 'username', u.username, 'avatar_url', u.avatar_url) as sender
                FROM chat_messages m
                JOIN users u ON m.sender_id = u.user_id
                WHERE m.room_id = $1
                ORDER BY m.created_at ASC
            `, [roomId]);

            // Mark notifications as read
            await client.query(`
                UPDATE notifications
                SET is_read = true
                WHERE user_id = $1 AND room_id = $2
            `, [userId, roomId]);

            await client.query('COMMIT');
            return messagesResult.rows;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    async getPrivateChatMessages(privateChatId, userId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Get messages
            const messagesResult = await client.query(`
                SELECT 
                    m.message_id,
                    m.content,
                    m.created_at,
                    json_build_object('id', u.user_id, 'username', u.username, 'avatar_url', u.avatar_url) as sender
                FROM chat_messages m
                JOIN users u ON m.sender_id = u.user_id
                WHERE m.private_chat_id = $1
                ORDER BY m.created_at ASC
            `, [privateChatId]);

            // Mark notifications as read
            await client.query(`
                UPDATE notifications
                SET is_read = true
                WHERE user_id = $1 AND private_chat_id = $2
            `, [userId, privateChatId]);

            await client.query('COMMIT');
            return messagesResult.rows;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    // Get unread counts for initial load
    async getUnreadCounts(userId) {
        const result = await pool.query(`
            SELECT 
                COALESCE(
                    json_object_agg(
                        CASE 
                            WHEN room_id IS NOT NULL THEN 'room_' || room_id::text
                            ELSE 'chat_' || private_chat_id::text
                        END,
                        count
                    ),
                    '{}'::json
                ) as unread_counts
            FROM (
                SELECT room_id, private_chat_id, COUNT(*) as count
                FROM notifications
                WHERE user_id = $1 AND is_read = false
                GROUP BY room_id, private_chat_id
            ) counts
        `, [userId]);
        return result.rows[0].unread_counts;
    },

    async inviteToRoom(roomId, inviterId, inviteeId) {
        const result = await pool.query(
            'INSERT INTO group_invites (room_id, inviter_id, invitee_id, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [roomId, inviterId, inviteeId, 'pending']
        );
        return result.rows[0];
    },

    async respondToInvite(inviteId, status) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Update invite status
            const inviteResult = await client.query(
                'UPDATE group_invites SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE invite_id = $2 RETURNING *',
                [status, inviteId]
            );

            if (inviteResult.rows.length === 0) {
                throw new Error('Invite not found');
            }

            const invite = inviteResult.rows[0];

            // If accepted, add user to room
            if (status === 'accepted') {
                await client.query(
                    'INSERT INTO user_rooms (user_id, room_id) VALUES ($1, $2)',
                    [invite.invitee_id, invite.room_id]
                );
            }

            await client.query('COMMIT');
            return invite;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    async getUserById(userId) {
        const result = await pool.query('SELECT user_id as id, username, email, avatar_url FROM users WHERE user_id = $1', [userId]);
        return result.rows[0];
    },

    async createRoomInvite(userId, roomId, invitedBy) {
        const result = await pool.query(
            'INSERT INTO group_invites (invitee_id, room_id, inviter_id) VALUES ($1, $2, $3) RETURNING *',
            [userId, roomId, invitedBy]
        );
        return result.rows[0];
    },

    async getRoomInvites(userId) {
        const result = await pool.query(`
            SELECT 
                gi.invite_id,
                gi.room_id,
                r.name as room_name,
                json_build_object('id', u.user_id, 'username', u.username) as inviter,
                gi.created_at
            FROM group_invites gi
            JOIN chat_rooms r ON gi.room_id = r.room_id
            JOIN users u ON gi.inviter_id = u.user_id
            WHERE gi.invitee_id = $1 AND gi.status = 'pending'
            ORDER BY gi.created_at DESC
        `, [userId]);
        return result.rows;
    },

    async getAvailableRooms(userId) {
        const result = await pool.query(`
            SELECT 
                r.room_id,
                r.name,
                r.created_at,
                json_build_object('id', u.user_id, 'username', u.username) as created_by,
                (
                    SELECT COUNT(*)
                    FROM user_rooms ur2
                    WHERE ur2.room_id = r.room_id
                ) as member_count
            FROM chat_rooms r
            LEFT JOIN user_rooms ur ON r.room_id = ur.room_id AND ur.user_id = $1
            JOIN users u ON r.created_by = u.user_id
            WHERE ur.user_id IS NULL
                AND r.is_private = false
            GROUP BY r.room_id, r.name, r.created_at, u.user_id, u.username
            ORDER BY r.created_at DESC
        `, [userId]);
        return result.rows;
    },

    async joinRoom(userId, roomId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check if room exists and get its details
            const roomResult = await client.query(
                'SELECT * FROM chat_rooms WHERE room_id = $1',
                [roomId]
            );

            if (roomResult.rows.length === 0) {
                throw new Error('Room not found');
            }

            // Check if user is already in the room
            const memberResult = await client.query(
                'SELECT * FROM user_rooms WHERE user_id = $1 AND room_id = $2',
                [userId, roomId]
            );

            if (memberResult.rows.length > 0) {
                await client.query('COMMIT');
                return roomResult.rows[0];
            }

            // Add user to room
            await client.query(
                'INSERT INTO user_rooms (user_id, room_id) VALUES ($1, $2)',
                [userId, roomId]
            );

            // Get full room details
            const result = await client.query(`
                SELECT 
                    r.room_id,
                    r.name,
                    r.is_private,
                    r.created_at,
                    r.created_by,
                    array_agg(json_build_object(
                        'id', u.user_id,
                        'username', u.username,
                        'avatar_url', COALESCE(u.avatar_url, '')
                    )) as members
                FROM chat_rooms r
                JOIN user_rooms ur ON r.room_id = ur.room_id
                JOIN users u ON ur.user_id = u.user_id
                WHERE r.room_id = $1
                GROUP BY r.room_id, r.name, r.is_private, r.created_at, r.created_by
            `, [roomId]);

            await client.query('COMMIT');
            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    // Authentication checks
    async isUserInRoom(userId, roomId) {
        const result = await pool.query(
            'SELECT 1 FROM user_rooms WHERE user_id = $1 AND room_id = $2',
            [userId, roomId]
        );
        return result.rows.length > 0;
    },

    async isUserInPrivateChat(userId, chatId) {
        const result = await pool.query(
            'SELECT 1 FROM private_chats WHERE chat_id = $1 AND (user1_id = $2 OR user2_id = $2)',
            [chatId, userId]
        );
        return result.rows.length > 0;
    },

    async getUserOnlineStatus(userId) {
        const result = await pool.query(
            'SELECT last_login FROM users WHERE user_id = $1',
            [userId]
        );
        return result.rows[0]?.last_login;
    },

    async getRoomDetails(roomId) {
        const result = await pool.query(`
            SELECT 
                r.room_id,
                r.name,
                r.created_at,
                json_build_object('id', u.user_id, 'username', u.username) as created_by,
                array_agg(json_build_object(
                    'id', m.user_id,
                    'username', m.username,
                    'joined_at', m.joined_at
                )) as members
            FROM chat_rooms r
            JOIN users u ON r.created_by = u.user_id
            JOIN (
                SELECT ur.user_id, ur.room_id, u.username, ur.joined_at
                FROM user_rooms ur
                JOIN users u ON ur.user_id = u.user_id
            ) m ON r.room_id = m.room_id
            WHERE r.room_id = $1
            GROUP BY r.room_id, r.name, r.created_at, u.user_id, u.username
        `, [roomId]);
        return result.rows[0];
    },

    async getPrivateChatDetails(chatId) {
        const result = await pool.query(`
            SELECT 
                pc.chat_id,
                pc.user1_id,
                pc.user2_id,
                pc.created_at,
                json_build_object(
                    'id', u1.user_id,
                    'username', u1.username,
                    'avatar_url', COALESCE(u1.avatar_url, '')
                ) as user1,
                json_build_object(
                    'id', u2.user_id,
                    'username', u2.username,
                    'avatar_url', COALESCE(u2.avatar_url, '')
                ) as user2
            FROM private_chats pc
            JOIN users u1 ON pc.user1_id = u1.user_id
            JOIN users u2 ON pc.user2_id = u2.user_id
            WHERE pc.chat_id = $1
        `, [chatId]);
        return result.rows[0];
    }
};

export default queries;
