import { ROOM_ID_PATTERN } from './constants.js';
import { MESSAGES } from './messages.js';

/**
 * Валидация ID комнаты (UUID v4)
 */

/**
 * Валидация ID комнаты
 * @param {string} roomId
 * @returns {Object} {valid: boolean, value?: string, error?: string}
 */
export function validateRoomId(roomId) {
  if (!roomId || typeof roomId !== 'string') {
    return { valid: false, error: MESSAGES.roomId.required };
  }

  if (!ROOM_ID_PATTERN.test(roomId)) {
    return { valid: false, error: MESSAGES.roomId.invalid };
  }

  return { valid: true, value: roomId };
}
