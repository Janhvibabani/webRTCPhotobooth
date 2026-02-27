const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Track rooms: roomId -> [socketId, socketId]
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // Join a room
  socket.on('join-room', (roomId) => {
    const existing = rooms.get(roomId) || [];

    if (existing.length >= 2) {
      socket.emit('room-full');
      return;
    }

    existing.push(socket.id);
    rooms.set(roomId, existing);
    socket.join(roomId);
    socket.data.roomId = roomId;

    console.log(`[Room ${roomId}] ${socket.id} joined (${existing.length}/2)`);

    if (existing.length === 2) {
      // Tell the first user (initiator) to start the call
      const initiatorId = existing[0];
      io.to(initiatorId).emit('initiate-call');
      io.to(roomId).emit('room-ready', { count: 2 });
    } else {
      socket.emit('waiting');
    }
  });

  // Relay WebRTC offer
  socket.on('offer', ({ roomId, offer }) => {
    console.log(`[Room ${roomId}] Offer from ${socket.id}:`, offer.type);
    socket.to(roomId).emit('offer', { offer, from: socket.id });
    console.log(`[Room ${roomId}] Offer relayed to room`);
  });

  // Relay WebRTC answer
  socket.on('answer', ({ roomId, answer }) => {
    console.log(`[Room ${roomId}] Answer from ${socket.id}:`, answer.type);
    socket.to(roomId).emit('answer', { answer, from: socket.id });
    console.log(`[Room ${roomId}] Answer relayed to room`);
  });

  // Relay ICE candidates
  socket.on('ice-candidate', ({ roomId, candidate }) => {
    console.log(`[Room ${roomId}] ICE candidate from ${socket.id}:`, candidate.candidate.substring(0, 50) + '...');
    socket.to(roomId).emit('ice-candidate', { candidate, from: socket.id });
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (roomId && rooms.has(roomId)) {
      const updated = rooms.get(roomId).filter(id => id !== socket.id);
      if (updated.length === 0) {
        rooms.delete(roomId);
      } else {
        rooms.set(roomId, updated);
        io.to(roomId).emit('peer-disconnected');
      }
      console.log(`[-] ${socket.id} left room ${roomId}`);
    }
    console.log(`[-] Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎬 WebRTC Photobooth signaling server running`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://<your-ip>:${PORT}\n`);
});