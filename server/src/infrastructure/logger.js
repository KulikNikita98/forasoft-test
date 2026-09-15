import winston from 'winston';
import config from '../config/index.js';

/**
 * Create winston logger instance.
 * Log level is taken from the LOG_LEVEL env variable.
 */
export function createLogger() {
  return winston.createLogger({
    level: config.logLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
      })
    ),
    transports: [new winston.transports.Console()]
  });
}
