import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Root of the server package (two levels up from src/infrastructure)
const SERVER_ROOT = path.resolve(__dirname, '../..');

/**
 * Resolve a possibly-relative path against the server package root
 * @param {string} p
 * @returns {string}
 */
function resolvePath(p) {
  return path.isAbsolute(p) ? p : path.join(SERVER_ROOT, p);
}

/**
 * Load SSL certificate and key for HTTPS server.
 * Paths are taken from SSL_CERT_PATH / SSL_KEY_PATH env variables.
 * @returns {{cert: Buffer, key: Buffer}}
 */
export function loadSSLCredentials() {
  return {
    cert: fs.readFileSync(resolvePath(config.ssl.certPath)),
    key: fs.readFileSync(resolvePath(config.ssl.keyPath))
  };
}
