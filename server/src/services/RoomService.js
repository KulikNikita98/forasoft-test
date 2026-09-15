import Room from '../models/Room.js';

// Пустая комната живёт не дольше этого времени (мс) до автоочистки
const EMPTY_ROOM_TTL_MS = 5 * 60 * 1000; // 5 минут

/**
 * RoomService — управление комнатами и участниками
 * Бизнес-логика для работы с комнатами видеочата
 */
class RoomService {
  /**
   * @param {{ emptyRoomTtlMs?: number }} [options]
   */
  constructor(options = {}) {
    this.rooms = new Map(); // roomId -> Room
    this.emptyRoomTtlMs = options.emptyRoomTtlMs ?? EMPTY_ROOM_TTL_MS;
  }

  /**
   * Создать новую комнату
   * @param {string} roomId
   * @returns {Room}
   */
  createRoom(roomId) {
    // Ленивая очистка «осиротевших» пустых комнат при каждом создании
    this.cleanupEmptyRooms();

    const room = new Room(roomId);
    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Удалить пустые комнаты, существующие дольше TTL.
   * Защита от утечки памяти: комнаты, созданные через REST,
   * в которые никто не вошёл по WebSocket, не остаются навсегда.
   * @returns {number} количество удалённых комнат
   */
  cleanupEmptyRooms() {
    const now = Date.now();
    let removed = 0;
    for (const [roomId, room] of this.rooms) {
      if (room.isEmpty() && now - room.createdAt > this.emptyRoomTtlMs) {
        this.rooms.delete(roomId);
        removed++;
      }
    }
    return removed;
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

    // Атомарная проверка лимита + вставка (инвариант живёт в модели)
    const result = room.tryAddParticipant(socketId, userName);
    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, room, participant: result.participant };
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
