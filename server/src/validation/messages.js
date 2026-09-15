/**
 * Локализованные сообщения об ошибках валидации (русский язык)
 */

import { USERNAME_MAX_LENGTH, MESSAGE_MAX_LENGTH } from './constants.js';

export const MESSAGES = {
  userName: {
    required: 'Имя обязательно',
    empty: 'Имя не может быть пустым',
    invalid: `Имя может содержать только буквы, цифры, пробелы, _ и - (макс. ${USERNAME_MAX_LENGTH} символов)`
  },
  roomId: {
    required: 'ID комнаты обязателен',
    invalid: 'Некорректный формат ID комнаты'
  },
  message: {
    empty: 'Сообщение не может быть пустым',
    tooLong: `Сообщение слишком длинное (макс. ${MESSAGE_MAX_LENGTH} символов)`
  }
};
