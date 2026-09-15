import config from '../config/index.js';

// userName: буквы (любой алфавит), цифры, пробелы, _ и - (1-30 символов)
// Зеркалит серверную регулярку (server/src/validation/constants.js)
const USERNAME_PATTERN = /^[\p{L}\p{N} _-]{1,30}$/u;

/**
 * Клиентская валидация отображаемого имени.
 * @param {string} userName
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
export function validateUserName(userName) {
  if (typeof userName !== 'string') {
    return { valid: false, error: 'Введите имя' };
  }

  const trimmed = userName.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Введите имя' };
  }

  if (trimmed.length > config.app.maxUsernameLength) {
    return {
      valid: false,
      error: `Имя не должно превышать ${config.app.maxUsernameLength} символов`
    };
  }

  if (!USERNAME_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: 'Имя может содержать только буквы, цифры, пробелы, _ и -'
    };
  }

  return { valid: true, value: trimmed };
}
