import express from 'express'
import session from 'express-session'
import ViteExpress from 'vite-express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'

// Import routes
import authRoutes from './routes/auth.js'
import roomRoutes from './routes/rooms.js'
import privateChatRoutes from './routes/privateChats.js'
import inviteRoutes from './routes/invites.js'
import socketHandlers from './socket/handlers.js'
import queries from './db/queries.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const httpServer = createServer(app)

// Enable CORS with credentials
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}))

// Middleware
app.use(express.json())

// Create session middleware
const sessionMiddleware = session({
    name: 'sessionId',
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
    }
})

// Use session middleware
app.use(sessionMiddleware)

// Configure Socket.IO
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
    }
})

// Share session middleware with Socket.IO
const wrap = middleware => (socket, next) => middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

// Add authentication middleware for sockets
io.use((socket, next) => {
    const session = socket.request.session;
    if (!session || !session.user) {
        next(new Error('Unauthorized'));
        return;
    }
    socket.user = session.user;
    next();
});

// Initialize socket handlers with io instance
io.on('connection', (socket) => {
    console.log('User connected:', socket.user.username);
    socketHandlers(io, socket);
});

// File upload configuration
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

// File upload endpoint
app.post('/upload', (req, res) => {
    upload(req, res, function (err) {
        if (err) {
            return res.status(400).json({ error: err.message })
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' })
        }
        res.json({ 
            filename: req.file.filename,
            path: `/uploads/${req.file.filename}`
        })
    })
})

// Initialize routes
authRoutes(app, io)
roomRoutes(app, io)
privateChatRoutes(app)
inviteRoutes(app)

// Start server
httpServer.listen(3000, () => {
    console.log('Server running on port 3000')
})

ViteExpress.bind(app, httpServer)