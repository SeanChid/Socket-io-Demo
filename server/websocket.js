import { Server } from 'socket.io'

const initializeSocketServer = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "http://localhost:3000",
            methods: ["GET", "POST"]
        }
    })

    io.on('connection', (socket) => {
        console.log('a user connected')

        socket.on('message', (msg) => {
            io.emit('message', msg)
        })

        socket.on('disconnect', () => {
            console.log('user disconnected')
        })
    })
}

export default initializeSocketServer