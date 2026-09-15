import Room from '../models/Room.js';

/**
 * RoomService — управление комнатами и участниками
 * Бизнес-логика для работы с комнатами видеочата
 */
class RoomService {
  constructor() {
    this.rooms = new Map(); // roomId -> Room
  }

  /**
   * Создать новую комнату
   * @param {string} roomId
   * @returns {Room}
   */
  createRoom(roomId) {
    const room = new Room(roomId);
    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Получить комнату по ID
   * @param {string} roomId
   * @returns {Room|undefined}
   */
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  /**
   * Получить или создать комнату
   * @param {string} roomId
   * @returns {Room}
   */
  getOrCreateRoom(roomId) {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = this.createRoom(roomId);
    }
    return room;
  }

  /**
   * Удалить комнату
   * @param {string} roomId
   * @returns {boolean}
   */
  deleteRoom(roomId) {
    return this.rooms.delete(roomId);
  }

  /**
   * Проверить существование комнаты
   * @param {string} roomId
   * @returns {boolean}
   */
  roomExists(roomId) {
    return this.rooms.has(roomId);
  }

  /**
   * Добавить участника в комнату
   * @param {string} roomId
   * @param {string} socketId
   * @param {string} userName
   * @returns {{ success: boolean, room?: Room, participant?: Participant, error?: string }}
   */
  addParticipant(roomId, socketId, userName) {
    const room = this.getOrCreateRoom(roomId);

    if (room.isFull()) {
      return { success: false, error: 'room-full' };
    }

    const participant = room.addParticipant(socketId, userName);
    return { success: true, room, participant };
  }

  /**
   * Удалить участника из комнаты
   * @param {string} roomId
   * @param {string} socketId
   * @returns {{ participant?: Participant, shouldDeleteRoom: boolean }}
   */
  removeParticipant(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { shouldDeleteRoom: false };
    }

    const participant = room.removeParticipant(socketId);

    const shouldDeleteRoom = room.isEmpty();
    if (shouldDeleteRoom) {
      this.deleteRoom(roomId);
    }

    return { participant, shouldDeleteRoom };
  }

  /**
   * Обновить состояние медиа участника
   * @param {string} roomId
   * @param {string} socketId
   * @param {{ audio?: boolean, video?: boolean }} mediaState
   * @returns {boolean}
   */
  updateMediaState(roomId, socketId, mediaState) {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    const participant = room.getParticipant(socketId);
    if (!participant) return false;

    participant.updateMediaState(mediaState);
    return true;
  }

  /**
   * Добавить сообщение в чат комнаты
   * @param {string} roomId
   * @param {object} message
   * @returns {object|null}
   */
  addChatMessage(roomId, message) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return room.addChatMessage(message);
  }

  /**
   * Получить историю чата комнаты
   * @param {string} roomId
   * @returns {Array}
   */
  getChatHistory(roomId) {
    const room = this.rooms.get(roomId);
    return room ? room.chatHistory : [];
  }
}

export default RoomService;
