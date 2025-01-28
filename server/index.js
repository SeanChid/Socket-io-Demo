import express from 'express'
import session from 'express-session'
import ViteExpress from 'vite-express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { queries } from './db/queries.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer)

// Middleware
app.use(express.json())

// Create session middleware
const sessionMiddleware = session({
    secret: 'superBeans',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        sameSite: 'lax'
    },
    name: 'sessionId' // Change cookie name from connect.sid
});

// Use session middleware
app.use(sessionMiddleware);

// Auth middleware
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// User routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, password, email } = req.body;
        if (!username || !password || !email) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const user = await queries.createUser(username, password, email);
        
        // Set user in session with consistent property names
        req.session.user = {
            id: user.user_id,
            username: user.username,
            email: user.email
        };
        
        // Save session explicitly
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Failed to create session' });
            }
            res.json({ 
                id: user.user_id,
                username: user.username,
                email: user.email
            });
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ error: 'Username or email already taken' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await queries.authenticateUser(username, password);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Set user in session with consistent property names
        req.session.user = {
            id: user.id,
            username: user.username
        };
        
        // Save session explicitly
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Failed to create session' });
            }
            res.json({ 
                id: user.id,
                username: user.username
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/logout', (req, res) => {
    if (req.session) {
        const username = req.session.user?.username;
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.status(500).json({ error: 'Failed to logout' });
            }
            if (username) {
                // Notify other users about logout
                io.emit('user-offline', { username });
            }
            res.clearCookie('sessionId');
            res.json({ message: 'Logged out successfully' });
        });
    } else {
        res.json({ message: 'Already logged out' });
    }
});

app.get('/api/session', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ 
            authenticated: true, 
            user: {
                id: req.session.user.id,
                username: req.session.user.username
            }
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Chat room routes
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

app.get('/api/rooms/:id/messages', requireAuth, async (req, res) => {
    try {
        const messages = await queries.getRoomMessages(req.params.id);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Private chat routes
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

// Room invite routes
app.post('/api/rooms/:id/invites', requireAuth, async (req, res) => {
    try {
        const { userId } = req.body;
        const invite = await queries.inviteToRoom(req.params.id, req.session.user.id, userId);
        res.json(invite);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/invites/:id/respond', requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['accepted', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        const invite = await queries.respondToInvite(req.params.id, status);
        res.json(invite);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// File upload endpoint
app.post('/upload', (req, res) => {
    const storage = multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, path.join(__dirname, '../public/uploads'))
        },
        filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
            cb(null, uniqueSuffix + path.extname(file.originalname))
        }
    })

    const upload = multer({
        storage: storage,
        limits: {
            fileSize: 5 * 1024 * 1024 // 5MB limit
        },
        fileFilter: function (req, file, cb) {
            // Accept images and common file types
            const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/
            const extname = filetypes.test(path.extname(file.originalname).toLowerCase())
            const mimetype = filetypes.test(file.mimetype)

            if (extname && mimetype) {
                return cb(null, true)
            } else {
                cb('Error: Only images and common document types are allowed!')
            }
        }
    }).single('file')

    upload(req, res, function (err) {
        if (err) {
            return res.status(400).json({ error: err.message })
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' })
        }
        
        const fileUrl = `/uploads/${req.file.filename}`
        res.json({ 
            url: fileUrl,
            filename: req.file.originalname,
            type: req.file.mimetype
        })
    })
})

app.use(express.static('public'))
app.use(express.urlencoded({extended: false}))

// Socket.IO configuration with session and auth middleware
io.engine.use(sessionMiddleware);

// Add authentication middleware for Socket.IO
io.use((socket, next) => {
    const session = socket.request.session;
    if (session && session.user) {
        socket.user = session.user;
        next();
    } else {
        next(new Error('Unauthorized'));
    }
});

// Socket.IO handling
io.on('connection', (socket) => {
    console.log('User connected:', socket.user.username);

    // Notify others in user's rooms that they're online
    socket.broadcast.emit('user-online', { userId: socket.user.id, username: socket.user.username });

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
            // Verify chat membership
            const isMember = await queries.isUserInPrivateChat(socket.user.id, chatId);
            if (!isMember) {
                socket.emit('error', { message: 'Not a member of this chat' });
                return;
            }
            socket.join(`private:${chatId}`);
        } catch (error) {
            socket.emit('error', { message: 'Failed to join private chat' });
        }
    });

    // Leave private chat
    socket.on('leave-private-chat', (chatId) => {
        socket.leave(`private:${chatId}`);
    });

    // Send message to room
    socket.on('send-room-message', async ({ roomId, content }) => {
        try {
            if (!socket.user) {
                socket.emit('error', { message: 'Unauthorized' });
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
            const message = await queries.addMessage(content, socket.user.id, null, chatId);
            io.to(`private:${chatId}`).emit('new-message', message);
        } catch (error) {
            console.error('Error sending private message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.user.username);
        // Notify others that user is offline
        socket.broadcast.emit('user-offline', { 
            userId: socket.user.id, 
            username: socket.user.username 
        });
    });
});

httpServer.listen(3000, () => {
    console.log('Server running on port 3000');
});

ViteExpress.bind(app, httpServer)