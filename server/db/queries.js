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
                   )) as members
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
                END as other_user
            FROM private_chats pc
            JOIN users u1 ON pc.user1_id = u1.user_id
            JOIN users u2 ON pc.user2_id = u2.user_id
            WHERE pc.user1_id = $1 OR pc.user2_id = $1
            ORDER BY pc.created_at DESC
        `, [userId]);
        return result.rows;
    },

    async addMessage(content, senderId, roomId = null, privateChatId = null) {
        const result = await pool.query(`
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
        return result.rows[0];
    },

    async getRoomMessages(roomId) {
        const result = await pool.query(`
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
        return result.rows;
    },

    async getPrivateChatMessages(privateChatId) {
        const result = await pool.query(`
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
        return result.rows;
    },

    async inviteToRoom(roomId, inviterId, inviteeId) {
        const result = await pool.query(
            'INSERT INTO group_invites (room_id, inviter_id, invitee_id) VALUES ($1, $2, $3) RETURNING *',
            [roomId, inviterId, inviteeId]
        );
        return result.rows[0];
    },

    async respondToInvite(inviteId, status) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // First check if invite exists and is pending
            const checkInvite = await client.query(
                'SELECT * FROM group_invites WHERE invite_id = $1 AND status = \'pending\'',
                [inviteId]
            );

            if (checkInvite.rows.length === 0) {
                throw new Error('Invite not found or already responded to');
            }

            const invite = await client.query(
                'UPDATE group_invites SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE invite_id = $2 RETURNING *',
                [status, inviteId]
            );

            if (status === 'accepted') {
                await client.query(
                    'INSERT INTO user_rooms (user_id, room_id) VALUES ($1, $2)',
                    [invite.rows[0].invitee_id, invite.rows[0].room_id]
                );
            }

            await client.query('COMMIT');
            return invite.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    async getUserById(userId) {
        const result = await pool.query(
            'SELECT user_id as id, username FROM users WHERE user_id = $1',
            [userId]
        );
        return result.rows[0];
    },

    async createRoomInvite(userId, roomId, invitedBy) {
        const result = await pool.query(
            'INSERT INTO group_invites (invitee_id, room_id, inviter_id) VALUES ($1, $2, $3) RETURNING invite_id',
            [userId, roomId, invitedBy]
        );
        return result.rows[0];
    },

    async getRoomInvites(userId) {
        const result = await pool.query(`
            SELECT 
                gi.invite_id,
                gi.room_id,
                cr.name as room_name,
                u.username as invited_by_username,
                u.user_id as invited_by_id,
                gi.created_at
            FROM group_invites gi
            JOIN chat_rooms cr ON gi.room_id = cr.room_id
            JOIN users u ON gi.inviter_id = u.user_id
            WHERE gi.invitee_id = $1 AND gi.status = 'pending'
            ORDER BY gi.created_at DESC
        `, [userId]);
        return result.rows;
    },

    // Get all public rooms that the user hasn't joined
    async getAvailableRooms(userId) {
        const result = await pool.query(`
            SELECT 
                r.room_id,
                r.name,
                r.created_at,
                COUNT(DISTINCT ur.user_id) as member_count,
                json_build_object(
                    'id', u.user_id,
                    'username', u.username,
                    'avatar_url', COALESCE(u.avatar_url, '')
                ) as created_by
            FROM chat_rooms r
            JOIN users u ON r.created_by = u.user_id
            LEFT JOIN user_rooms ur ON r.room_id = ur.room_id
            WHERE NOT r.is_private 
            AND r.room_id NOT IN (
                SELECT room_id FROM user_rooms WHERE user_id = $1
            )
            GROUP BY r.room_id, r.name, r.created_at, u.user_id, u.username, u.avatar_url
            ORDER BY r.created_at DESC
        `, [userId]);
        return result.rows;
    },

    // Join a room
    async joinRoom(userId, roomId) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Check if room exists and get its details
            const roomCheck = await client.query(
                'SELECT room_id, is_private, created_by FROM chat_rooms WHERE room_id = $1',
                [roomId]
            );

            if (roomCheck.rows.length === 0) {
                throw new Error('Room not found');
            }

            const room = roomCheck.rows[0];

            // Check if user is already in the room
            const memberCheck = await client.query(
                'SELECT 1 FROM user_rooms WHERE user_id = $1 AND room_id = $2',
                [userId, roomId]
            );

            // Only try to join if not already a member
            if (memberCheck.rows.length === 0) {
                // Allow joining if:
                // 1. User is the creator
                // 2. Room is public
                // 3. User has an invitation
                if (parseInt(room.created_by) !== parseInt(userId) && room.is_private) {
                    // Check for invitation
                    const inviteCheck = await client.query(
                        'SELECT 1 FROM group_invites WHERE room_id = $1 AND invitee_id = $2 AND status = \'pending\'',
                        [roomId, userId]
                    );
                    
                    if (inviteCheck.rows.length === 0) {
                        throw new Error('Cannot join private room without invitation');
                    }
                }

                // Add user to room
                await client.query(
                    'INSERT INTO user_rooms (user_id, room_id) VALUES ($1, $2)',
                    [userId, roomId]
                );

                // If user had an invitation, mark it as accepted
                await client.query(
                    'UPDATE group_invites SET status = \'accepted\' WHERE room_id = $1 AND invitee_id = $2 AND status = \'pending\'',
                    [roomId, userId]
                );
            }

            // Get updated room details
            const roomDetails = await client.query(`
                SELECT 
                    r.room_id, 
                    r.name, 
                    r.is_private, 
                    r.created_at, 
                    r.created_by,
                    COALESCE(
                        array_agg(
                            json_build_object(
                                'id', u.user_id, 
                                'username', u.username, 
                                'avatar_url', COALESCE(u.avatar_url, '')
                            )
                        ) FILTER (WHERE u.user_id IS NOT NULL),
                        '{}'::json[]
                    ) as members
                FROM chat_rooms r
                LEFT JOIN user_rooms ur ON r.room_id = ur.room_id
                LEFT JOIN users u ON ur.user_id = u.user_id
                WHERE r.room_id = $1
                GROUP BY r.room_id, r.name, r.is_private, r.created_at, r.created_by
            `, [roomId]);

            await client.query('COMMIT');
            return roomDetails.rows[0];
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
        return result.rows[0]?.last_login || null;
    },

    async getRoomDetails(roomId) {
        const result = await pool.query(`
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
        return result.rows[0];
    }
};

export default queries;
