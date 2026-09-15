import DOMPurify from 'isomorphic-dompurify';
import { MESSAGE_MIN_LENGTH, MESSAGE_MAX_LENGTH, SANITIZE_OPTIONS } from './constants.js';
import { MESSAGES } from './messages.js';

/**
 * Валидация и санитизация текстового сообщения
 */

/**
 * Валидация текстового сообщения
 * @param {string} message
 * @returns {Object} {valid: boolean, value?: string, error?: string}
 */
export function validateMessage(message) {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: MESSAGES.message.empty };
  }

  const trimmed = message.trim();

  if (trimmed.length < MESSAGE_MIN_LENGTH) {
    return { valid: false, error: MESSAGES.message.empty };
  }

  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    return { valid: false, error: MESSAGES.message.tooLong };
  }

  return { valid: true, value: trimmed };
}

/**
 * Санитизация текста сообщения (защита от XSS)
 * @param {string} message
 * @returns {string} безопасное сообщение
 */
export function sanitizeMessage(message) {
  if (!message) return '';

  const sanitized = DOMPurify.sanitize(message, SANITIZE_OPTIONS);

  return sanitized.trim().substring(0, MESSAGE_MAX_LENGTH);
}

/**
 * Комплексная обработка: валидация + санитизация
 * @param {string} message
 * @returns {Object} {valid: boolean, value?: string, error?: string}
 */
export function processMessage(message) {
  const validation = validateMessage(message);

  if (!validation.valid) {
    return validation;
  }

  const sanitized = sanitizeMessage(validation.value);

  // После санитизации сообщение может стать пустым (если состояло только из HTML)
  if (sanitized.trim().length === 0) {
    return { valid: false, error: MESSAGES.message.empty };
  }

  return { valid: true, value: sanitized };
}
