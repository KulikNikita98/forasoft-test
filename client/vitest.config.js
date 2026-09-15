import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    include: ['tests/**/*.{test.js,test.jsx,js,jsx}'],
    exclude: ['tests/setup.js', 'node_modules/**']
  }
});
