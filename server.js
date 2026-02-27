const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

// Track rooms: roomId -> [socketId, socketId]
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  socket.on('join-room', (roomId) => {
    const existing = rooms.get(roomId) || [];

    if (existing.length >= 2) {
      socket.emit('room-full');
      return;
    }

    // slot 0 = first person (left side), slot 1 = second person (right side)
    const mySlot = existing.length;
    existing.push(socket.id);
    rooms.set(roomId, existing);
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.slot   = mySlot;

    console.log(`[Room ${roomId}] ${socket.id} joined as slot ${mySlot} (${existing.length}/2)`);

    // Tell THIS client which slot they are
    socket.emit('assigned-slot', { slot: mySlot });

    if (existing.length === 2) {
      // Tell the first user (initiator) to start the call
      io.to(existing[0]).emit('initiate-call');
      io.to(roomId).emit('room-ready', { count: 2 });
    } else {
      socket.emit('waiting');
    }
  });

  socket.on('offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('offer', { offer, from: socket.id });
  });

  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', { answer, from: socket.id });
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', { candidate, from: socket.id });
  });

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