import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { Server } from 'socket.io';
import { loadSSLCredentials } from '../infrastructure/ssl.js';
import config from '../config/index.js';
import { createLogger } from '../infrastructure/logger.js';
import RoomService from '../services/RoomService.js';
import RoomController from '../controllers/RoomController.js';
import SocketController from '../controllers/SocketController.js';
import { createApiRouter } from '../routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Собранная статика клиента: server/src/setup → ../../../client/dist
const CLIENT_DIST = path.resolve(__dirname, '../../../client/dist');

/**
 * Create and configure the application (MVC architecture)
 * @returns {{server: https.Server, io: Server, logger: winston.Logger}}
 */
export function createApp() {
  const logger = createLogger();

  // Service layer (business logic) — shared between HTTP and WebSocket
  const roomService = new RoomService();

  // Express app
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // REST API routes (controllers)
  const roomController = new RoomController(roomService, logger);
  app.use('/api', createApiRouter(roomController));

  // В production раздаём собранный клиент (client/dist) + SPA-fallback
  if (config.nodeEnv === 'production') {
    app.use(express.static(CLIENT_DIST));
    // Express 5 / path-to-regexp v8: именованный splat вместо голого '*'
    app.get('/*splat', (req, res) => {
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
    logger.info(`Serving client static from ${CLIENT_DIST}`);
  }

  // SSL credentials
  const sslOptions = loadSSLCredentials();

  // HTTPS server
  const server = https.createServer(sslOptions, app);

  // Socket.io setup — clients connect only when entering a room
  const io = new Server(server, config.socketIO);

  // WebSocket controller (real-time: chat, WebRTC signaling)
  const socketController = new SocketController(io, roomService, logger);

  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);
    socketController.handleConnection(socket);
  });

  return { server, io, logger };
}
