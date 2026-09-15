import config from '../config/index.js';

/**
 * REST API-клиент для управления комнатами.
 * Использует Vite-proxy (/api → backend), поэтому базовый путь относительный.
 */

/**
 * Создать новую комнату.
 * @param {string} userName
 * @returns {Promise<{ roomId: string, createdAt: number }>}
 * @throws {Error} при ошибке валидации или сети
 */
export async function createRoom(userName) {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Не удалось создать комнату');
  }

  return res.json();
}

/**
 * Получить информацию о комнате.
 * @param {string} roomId
 * @returns {Promise<{ exists: boolean, participantCount: number, isFull: boolean }>}
 */
export async function getRoom(roomId) {
  const res = await fetch(`/api/rooms/${roomId}`);
  if (!res.ok) {
    if (res.status === 404) {
      return { exists: false, participantCount: 0, isFull: false };
    }
    throw new Error('Не удалось получить информацию о комнате');
  }
  return res.json();
}

export default { createRoom, getRoom, baseUrl: config.api.baseUrl };
