import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

// SSL-сертификаты (mkcert) из server/certs — HTTPS обязателен для getUserMedia
const certDir = path.resolve(import.meta.dirname, '../server/certs');
const httpsOptions = {
  key: fs.readFileSync(path.join(certDir, 'localhost+2-key.pem')),
  cert: fs.readFileSync(path.join(certDir, 'localhost+2.pem'))
};

const BACKEND_URL = 'https://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    https: httpsOptions,
    proxy: {
      // REST API → backend
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false
      },
      // Socket.io (WebSocket) → backend
      '/socket.io': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
});
