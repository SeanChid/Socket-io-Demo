-- Drop tables in correct order
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS group_invites CASCADE;
DROP TABLE IF EXISTS private_chats CASCADE;
DROP TABLE IF EXISTS user_rooms CASCADE;
DROP TABLE IF EXISTS chat_rooms CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255),
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat rooms table
CREATE TABLE chat_rooms (
    room_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_by INTEGER REFERENCES users(user_id),
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User rooms (for managing room membership)
CREATE TABLE user_rooms (
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES chat_rooms(room_id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, room_id)
);

-- Private chats table (for direct messages)
CREATE TABLE private_chats (
    chat_id SERIAL PRIMARY KEY,
    user1_id INTEGER REFERENCES users(user_id),
    user2_id INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user1_id, user2_id)
);

-- Chat messages table
CREATE TABLE chat_messages (
    message_id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES chat_rooms(room_id) ON DELETE CASCADE,
    private_chat_id INTEGER REFERENCES private_chats(chat_id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(user_id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (room_id IS NOT NULL AND private_chat_id IS NULL) OR
        (room_id IS NULL AND private_chat_id IS NOT NULL)
    )
);

-- Group invites table
CREATE TABLE group_invites (
    invite_id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES chat_rooms(room_id) ON DELETE CASCADE,
    inviter_id INTEGER REFERENCES users(user_id),
    invitee_id INTEGER REFERENCES users(user_id),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN ('pending', 'accepted', 'rejected'))
);
