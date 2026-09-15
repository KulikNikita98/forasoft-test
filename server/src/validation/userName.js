import DOMPurify from 'isomorphic-dompurify';
import { USERNAME_PATTERN, USERNAME_MAX_LENGTH, SANITIZE_OPTIONS } from './constants.js';
import { MESSAGES } from './messages.js';

/**
 * Валидация и санитизация имени участника
 */

/**
 * Валидация имени участника
 * @param {string} userName
 * @returns {Object} {valid: boolean, value?: string, error?: string}
 */
export function validateUserName(userName) {
  if (!userName || typeof userName !== 'string') {
    return { valid: false, error: MESSAGES.userName.required };
  }

  const trimmed = userName.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: MESSAGES.userName.empty };
  }

  if (!USERNAME_PATTERN.test(trimmed)) {
    return { valid: false, error: MESSAGES.userName.invalid };
  }

  return { valid: true, value: trimmed };
}

/**
 * Санитизация имени пользователя (защита от XSS)
 * @param {string} userName
 * @returns {string} безопасное имя
 */
export function sanitizeUserName(userName) {
  if (!userName) return '';

  const sanitized = DOMPurify.sanitize(userName, SANITIZE_OPTIONS);

  return sanitized.trim().substring(0, USERNAME_MAX_LENGTH);
}

/**
 * Комплексная обработка: санитизация + валидация
 * @param {string} userName
 * @returns {Object} {valid: boolean, value?: string, error?: string}
 */
export function processUserName(userName) {
  const sanitized = sanitizeUserName(userName);
  const validation = validateUserName(sanitized);

  if (!validation.valid) {
    return validation;
  }

  return { valid: true, value: sanitized };
}
