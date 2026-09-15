/**
 * RoomController — REST API для управления комнатами
 */
class RoomController {
  /**
   * @param {import('../services/RoomService.js').default} roomService
   * @param {import('winston').Logger} logger
   */
  constructor(roomService, logger) {
    this.roomService = roomService;
    this.logger = logger;
  }

  /**
   * POST /api/rooms — создать новую комнату
   */
  createRoom = (req, res) => {
    try {
      const { userName } = req.body;

      if (!userName) {
        return res.status(400).json({ error: 'userName is required' });
      }

      // Генерация roomId
      const roomId = this.generateRoomId();
      const room = this.roomService.createRoom(roomId);

      this.logger.info(`Room created: ${roomId} by user ${userName}`);

      res.status(201).json({
        roomId: room.roomId,
        createdAt: room.createdAt
      });
    } catch (error) {
      this.logger.error(`Error creating room: ${error.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * GET /api/rooms/:roomId — получить информацию о комнате
   */
  getRoom = (req, res) => {
    try {
      const { roomId } = req.params;
      const room = this.roomService.getRoom(roomId);

      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      res.json({
        exists: true,
        participantCount: room.participants.size,
        isFull: room.isFull()
      });
    } catch (error) {
      this.logger.error(`Error getting room: ${error.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * GET /api/rooms/:roomId/participants — получить список участников
   */
  getParticipants = (req, res) => {
    try {
      const { roomId } = req.params;
      const room = this.roomService.getRoom(roomId);

      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      const participants = Array.from(room.participants.values()).map((p) => p.toJSON());

      res.json({ participants });
    } catch (error) {
      this.logger.error(`Error getting participants: ${error.message}`);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  /**
   * Генерация уникального roomId (6 символов)
   * @private
   */
  generateRoomId() {
    return Math.random().toString(36).substring(2, 8);
  }
}

export default RoomController;
