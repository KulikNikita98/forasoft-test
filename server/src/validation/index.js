/**
 * Модуль валидации и XSS-защиты
 * Разбит по доменным областям: userName, roomId, message
 */

export {
  validateUserName,
  sanitizeUserName,
  processUserName
} from './userName.js';

export {
  validateRoomId
} from './roomId.js';

export {
  validateMessage,
  sanitizeMessage,
  processMessage
} from './message.js';
