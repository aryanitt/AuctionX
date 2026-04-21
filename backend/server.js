require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth.routes');
const rfqRoutes = require('./routes/rfq.routes');
const { errorHandler } = require('./middlewares/errorHandler');
const { registerCronJobs } = require('./services/cronService');

const app = express();
const httpServer = http.createServer(app);

// ─── Socket.io ───────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Make io accessible in route handlers via req.app.get('io')
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[SOCKET] Client connected: ${socket.id}`);

  // Client joins a specific RFQ room to receive live bid updates
  socket.on('join_rfq', (rfqId) => {
    const room = `rfq:${rfqId}`;
    socket.join(room);
    console.log(`[SOCKET] ${socket.id} joined room ${room}`);
  });

  socket.on('leave_rfq', (rfqId) => {
    const room = `rfq:${rfqId}`;
    socket.leave(room);
    console.log(`[SOCKET] ${socket.id} left room ${room}`);
  });

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}`);
  });
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/rfqs', rfqRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'OK', timestamp: new Date() } });
});

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Database & Server Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/british-auction';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('[DB] Connected to MongoDB');

    httpServer.listen(PORT, () => {
      console.log(`[SERVER] Running on http://localhost:${PORT}`);
      registerCronJobs(io);
    });
  })
  .catch((error) => {
    console.error('[DB] Connection failed:', error.message);
    process.exit(1);
  });
