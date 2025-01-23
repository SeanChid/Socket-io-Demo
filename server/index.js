import express from 'express'
import session from 'express-session'
import ViteExpress from 'vite-express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer)

// Configure multer for file uploads
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

app.use(session({
    secret: 'superBeans',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}))

app.use(express.json())
app.use(express.static('public'))
app.use(express.urlencoded({extended: false}))

// File upload endpoint
app.post('/upload', (req, res) => {
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

io.on('connection', (socket) => {
    console.log('User connected:', socket.id)
    
    socket.on('set username', (username) => {
        socket.username = username
        socket.emit('username set', username)
        io.emit('user joined', { 
            message: `${username} joined the chat`,
            type: 'system'
        })
    })

    socket.on('chat message', (msg) => {
        io.emit('chat message', {
            userId: socket.id,
            username: socket.username,
            message: msg
        })
    })

    socket.on('media message', (data) => {
        io.emit('chat message', {
            userId: socket.id,
            username: socket.username,
            message: data.filename,
            mediaUrl: data.url,
            mediaType: data.type,
            isMedia: true
        })
    })

    socket.on('leave chat', (username) => {
        io.emit('user left', {
            message: `${username} left the chat`,
            type: 'system'
        })
    })

    socket.on('disconnect', () => {
        if (socket.username) {
            io.emit('user left', {
                message: `${socket.username} left the chat`,
                type: 'system'
            })
        }
        console.log('User disconnected:', socket.id)
    })
})

httpServer.listen(3000, () => {
    console.log('Server running on port 3000')
})

ViteExpress.bind(app, httpServer)