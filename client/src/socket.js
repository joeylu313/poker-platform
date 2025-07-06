import { io } from 'socket.io-client';

// Create a single socket instance to be shared across components
const socket = io('http://localhost:5001', {
  transports: ['websocket', 'polling']
});

// Add connection status logging
socket.on('connect', () => {
  console.log('Socket connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
});

socket.on('connect_error', (error) => {
  console.log('Socket connection error:', error);
});

export { socket }; 