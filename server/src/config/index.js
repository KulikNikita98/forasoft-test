import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigin: process.env.CORS_ORIGIN || 'https://localhost:5173',
  ssl: {
    certPath: process.env.SSL_CERT_PATH || './certs/localhost+2.pem',
    keyPath: process.env.SSL_KEY_PATH || './certs/localhost+2-key.pem'
  },
  socketIO: {
    cors: {
      origin: process.env.CORS_ORIGIN || 'https://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
    pingTimeout: parseInt(process.env.PING_TIMEOUT, 10) || 20000,
    pingInterval: parseInt(process.env.PING_INTERVAL, 10) || 25000
  }
};

export default config;
