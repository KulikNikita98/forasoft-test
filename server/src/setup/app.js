import https from 'https';
import express from 'express';
import { Server } from 'socket.io';
import { loadSSLCredentials } from '../infrastructure/ssl.js';
import config from '../config/index.js';
import { createLogger } from '../infrastructure/logger.js';
import RoomManager from '../domain/RoomManager.js';
import SignalingHandler from '../infrastructure/SignalingHandler.js';

/**
 * Create and configure the application
 * @returns {{server: https.Server, io: Server, logger: winston.Logger}}
 */
export function createApp() {
  const logger = createLogger();

  // Express app
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // SSL credentials
  const sslOptions = loadSSLCredentials();

  // HTTPS server
  const server = https.createServer(sslOptions, app);

  // Socket.io setup
  const io = new Server(server, config.socketIO);

  // Room manager and signaling handler
  const roomManager = new RoomManager();
  const signalingHandler = new SignalingHandler(io, roomManager, logger);

  // Socket.io connection handler
  io.on('connection', (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    // Register signaling handlers (join/leave/disconnecting)
    signalingHandler.register(socket);

    socket.on('disconnect', (reason) => {
      logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  return { server, io, logger };
}
