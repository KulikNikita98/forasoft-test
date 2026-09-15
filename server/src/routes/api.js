import express from 'express';

/**
 * Создать Express-роуты для REST API комнат
 * @param {import('../controllers/RoomController.js').default} roomController
 * @returns {express.Router}
 */
export function createApiRouter(roomController) {
  const router = express.Router();

  // POST /api/rooms — создать комнату
  router.post('/rooms', roomController.createRoom);

  // GET /api/rooms/:roomId — информация о комнате
  router.get('/rooms/:roomId', roomController.getRoom);

  // GET /api/rooms/:roomId/participants — список участников
  router.get('/rooms/:roomId/participants', roomController.getParticipants);

  return router;
}
