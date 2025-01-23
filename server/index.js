import express from 'express'
import session from 'express-session'
import ViteExpress from 'vite-express'
import { createServer } from 'http'
import { Server } from 'socket.io'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer)

app.use(session({
    secret: 'superBeans',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}))

app.use(express.json())
app.use(express.static('public'))
app.use(express.urlencoded({extended: false}))

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