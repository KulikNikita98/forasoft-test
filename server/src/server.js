import { createApp } from './setup/app.js';
import config from './config/index.js';

// Create and configure application
const { server, io, logger } = createApp();

// Start server
server.listen(config.port, () => {
  logger.info(`HTTPS server running on https://localhost:${config.port}`);
  logger.info(`Socket.io ready on port ${config.port}`);
});

// Graceful shutdown (SIGTERM / SIGINT)
function shutdown(signal) {
  logger.info(`${signal} received: shutting down`);
  io.close(() => {
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
