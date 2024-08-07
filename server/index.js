import express from 'express'
import session from 'express-session'
import ViteExpress from 'vite-express'
import http from 'http'
import initializeSocketServer from './websocket.js'

const app = express()

app.use(session({
    secret: 'superBeans',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}))

app.use(express.json())
app.use(express.static('public'))
app.use(express.urlencoded({extended: false}))

const server = http.createServer(app)

server.on('listening', () => {
    console.log('Server is listening on port 3000')
})

initializeSocketServer(server)

ViteExpress.listen(app, 8000, () => console.log('server is running on 8000'))