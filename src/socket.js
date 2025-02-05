import { io } from 'socket.io-client';

const socket = io('/', {
    autoConnect: true,
    withCredentials: true
});

// Handle connection events
socket.on('connect', () => {
    console.log('Connected to server');
    // Request user info on connection
    socket.emit('get-user-info');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

socket.on('error', (error) => {
    console.error('Socket error:', error);
});

export default socket;