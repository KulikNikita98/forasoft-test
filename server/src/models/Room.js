import crypto from 'crypto';
import Participant from './Participant.js';

/**
 * Room — комната видеочата
 */
class Room {
  /**
   * @param {string} roomId - Уникальный идентификатор комнаты
   */
  constructor(roomId) {
    this.roomId = roomId;
    this.participants = new Map(); // socketId -> Participant
    this.chatHistory = [];
    this.createdAt = Date.now();
    this.maxParticipants = 4;
  }

  /**
   * Добавить участника в комнату
   * @param {string} socketId
   * @param {string} userName
   * @returns {Participant}
   */
  addParticipant(socketId, userName) {
    const participant = new Participant(socketId, userName);
    this.participants.set(socketId, participant);
    return participant;
  }

  /**
   * Атомарно проверить лимит и добавить участника.
   * Проверка `isFull` и вставка выполняются в одном синхронном методе,
   * что гарантирует атомарность в single-threaded event loop —
   * между проверкой и вставкой не может вклиниться другое подключение.
   * @param {string} socketId
   * @param {string} userName
   * @returns {{ success: boolean, participant?: Participant, error?: string }}
   */
  tryAddParticipant(socketId, userName) {
    if (this.isFull()) {
      return { success: false, error: 'room-full' };
    }
    const participant = this.addParticipant(socketId, userName);
    return { success: true, participant };
  }

  /**
   * Удалить участника из комнаты
   * @param {string} socketId
   * @returns {Participant|undefined}
   */
  removeParticipant(socketId) {
    const participant = this.participants.get(socketId);
    this.participants.delete(socketId);
    return participant;
  }

  /**
   * Получить участника по socketId
   * @param {string} socketId
   * @returns {Participant|undefined}
   */
  getParticipant(socketId) {
    return this.participants.get(socketId);
  }

  /**
   * Проверить, полна ли комната
   * @returns {boolean}
   */
  isFull() {
    return this.participants.size >= this.maxParticipants;
  }

  /**
   * Проверить, пуста ли комната
   * @returns {boolean}
   */
  isEmpty() {
    return this.participants.size === 0;
  }

  /**
   * Добавить сообщение в историю чата
   * @param {object} message
   * @returns {object}
   */
  addChatMessage(message) {
    const chatMessage = {
      id: crypto.randomUUID(),
      ...message
    };
    this.chatHistory.push(chatMessage);
    return chatMessage;
  }

  /**
   * Сериализация для отправки клиенту
   */
  toJSON() {
    return {
      roomId: this.roomId,
      participantCount: this.participants.size,
      participants: Array.from(this.participants.values()).map((p) => p.toJSON()),
      isFull: this.isFull(),
      createdAt: this.createdAt
    };
  }
}

export default Room;
