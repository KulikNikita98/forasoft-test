/**
 * Application configuration
 * Loads environment variables via Vite's import.meta.env
 */

const config = {
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || 'https://localhost:3000',
    wsUrl: import.meta.env.VITE_WS_URL || 'https://localhost:3000'
  },
  app: {
    title: import.meta.env.VITE_APP_TITLE || 'Video Chat Room',
    maxParticipants: parseInt(import.meta.env.VITE_MAX_PARTICIPANTS, 10) || 4,
    maxMessageLength: parseInt(import.meta.env.VITE_MAX_MESSAGE_LENGTH, 10) || 1000,
    maxUsernameLength: parseInt(import.meta.env.VITE_MAX_USERNAME_LENGTH, 10) || 30
  }
};

export default config;
