/**
 * Константы для модуля валидации
 */

// userName: буквы (любой алфавит), цифры, пробелы, _ и - (1-30 символов)
export const USERNAME_PATTERN = /^[\p{L}\p{N} _-]{1,30}$/u;
export const USERNAME_MAX_LENGTH = 30;

// roomId: UUID v4 формат
export const ROOM_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// message: длина сообщения
export const MESSAGE_MIN_LENGTH = 1;
export const MESSAGE_MAX_LENGTH = 1000;

// Опции DOMPurify для полной очистки от HTML/JS
export const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true
};
