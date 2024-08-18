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
    console.log('a user connected')

    socket.on('chat message', (msg) => {
        console.log('message' + msg)
        io.emit('chat message', msg)
    })

    socket.on('disconnect', () => {
        console.log('user disconnected')
    })
})

// ViteExpress.listen(httpServer, 8000, () => console.log('server is running on 8000'))

httpServer.listen(8000, () => {
    console.log('server is listening on 8000')
})

ViteExpress.bind(app, httpServer)