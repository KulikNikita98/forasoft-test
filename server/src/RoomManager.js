import { randomUUID } from 'crypto';

/**
 * RoomManager - управление комнатами и участниками в памяти
 */
class RoomManager {
  constructor() {
    // Map<roomId: string, Room>
    this.rooms = new Map();
  }

  /**
   * Создать комнату (если не существует)
   * @param {string} roomId - ID комнаты
   * @returns {Room} объект комнаты
   */
  createRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      const room = {
        id: roomId,
        participants: new Map(), // socketId -> Participant
        messages: [],
        createdAt: new Date()
      };
      this.rooms.set(roomId, room);
    }
    return this.rooms.get(roomId);
  }

  /**
   * Получить комнату
   * @param {string} roomId
   * @returns {Room|undefined}
   */
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  /**
   * Удалить комнату
   * @param {string} roomId
   * @returns {boolean} true если комната была удалена
   */
  deleteRoom(roomId) {
    return this.rooms.delete(roomId);
  }

  /**
   * Добавить участника в комнату (с проверкой лимита)
   * @param {string} roomId
   * @param {string} socketId
   * @param {string} userName
   * @returns {Object} {success: boolean, participants?: array, chatHistory?: array, error?: string}
   */
  joinRoom(roomId, socketId, userName) {
    // Создать комнату если не существует
    const room = this.createRoom(roomId);

    // Атомарная проверка лимита (< 4)
    if (room.participants.size >= 4) {
      return {
        success: false,
        error: 'ROOM_FULL',
        message: 'Комната заполнена'
      };
    }

    // Добавить участника
    const participant = {
      socketId,
      userName,
      joinedAt: new Date()
    };
    room.participants.set(socketId, participant);

    // Вернуть текущее состояние комнаты
    return {
      success: true,
      participants: Array.from(room.participants.values()),
      chatHistory: room.messages
    };
  }

  /**
   * Удалить участника из комнаты
   * @param {string} socketId
   * @returns {Object|null} {roomId, participant, shouldDeleteRoom} или null если не найден
   */
  leaveRoom(socketId) {
    // Найти комнату участника
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.participants.has(socketId)) {
        const participant = room.participants.get(socketId);
        room.participants.delete(socketId);

        const shouldDeleteRoom = room.participants.size === 0;

        // Удалить комнату если последний участник вышел
        if (shouldDeleteRoom) {
          this.deleteRoom(roomId);
        }

        return {
          roomId,
          participant,
          shouldDeleteRoom
        };
      }
    }
    return null;
  }

  /**
   * Получить участников комнаты
   * @param {string} roomId
   * @returns {Array<Participant>}
   */
  getParticipants(roomId) {
    const room = this.getRoom(roomId);
    return room ? Array.from(room.participants.values()) : [];
  }

  /**
   * Получить количество участников в комнате
   * @param {string} roomId
   * @returns {number}
   */
  getRoomCount(roomId) {
    const room = this.getRoom(roomId);
    return room ? room.participants.size : 0;
  }

  /**
   * Добавить сообщение в историю чата комнаты
   * @param {string} roomId
   * @param {Object} message - {type, userName?, text, timestamp}
   * @returns {Object} сообщение с добавленным id
   */
  addChatMessage(roomId, message) {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const messageWithId = {
      id: randomUUID(),
      ...message,
      timestamp: message.timestamp || new Date().toISOString()
    };

    room.messages.push(messageWithId);
    return messageWithId;
  }

  /**
   * Получить историю чата комнаты
   * @param {string} roomId
   * @returns {Array<Message>}
   */
  getChatHistory(roomId) {
    const room = this.getRoom(roomId);
    return room ? room.messages : [];
  }

  /**
   * Найти комнату участника по socketId
   * @param {string} socketId
   * @returns {string|null} roomId или null
   */
  findRoomBySocketId(socketId) {
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.participants.has(socketId)) {
        return roomId;
      }
    }
    return null;
  }
}

export default RoomManager;
