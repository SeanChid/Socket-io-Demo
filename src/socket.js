import { io } from 'socket.io-client';

const socket = io('/', {
    autoConnect: true,
    withCredentials: true
});

export default socket;