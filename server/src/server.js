import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import winston from 'winston';

// Load environment variables
dotenv.config();

// ES modules __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Express app setup
const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files from client/dist in production
const clientDistPath = path.join(__dirname, '../../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  logger.info(`Serving static files from ${clientDistPath}`);
}

// Load SSL certificates
const certPath = path.join(__dirname, '../certs');
const sslOptions = {
  key: fs.readFileSync(path.join(certPath, 'localhost+2-key.pem')),
  cert: fs.readFileSync(path.join(certPath, 'localhost+2.pem'))
};

// Create HTTPS server
const server = https.createServer(sslOptions, app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'https://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: parseInt(process.env.PING_TIMEOUT) || 20000,
  pingInterval: parseInt(process.env.PING_INTERVAL) || 25000
});

// Socket.io connection handler
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('disconnect', (reason) => {
    logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
  });
});

// Start server
server.listen(PORT, () => {
  logger.info(`HTTPS server running on https://localhost:${PORT}`);
  logger.info(`Socket.io ready on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export { app, io, logger };
