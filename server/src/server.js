import { createApp } from './setup/app.js';
import config from './config/index.js';

// Create and configure application
const { server, logger } = createApp();

// Start server
server.listen(config.port, () => {
  logger.info(`HTTPS server running on https://localhost:${config.port}`);
  logger.info(`Socket.io ready on port ${config.port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});
