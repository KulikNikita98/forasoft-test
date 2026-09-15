import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const MAX_RETRIES = 3;

/**
 * useSocket — подключение к Socket.io при входе в комнату.
 * Параметры входа передаются в handshake.query (см. TDD раздел 6).
 *
 * @param {object} params
 * @param {string} params.roomId
 * @param {string} params.userName
 * @param {boolean} [params.enabled=true] — подключаться ли (false, пока нет имени)
 * @returns {{
 *   socket: import('socket.io-client').Socket | null,
 *   status: 'connecting' | 'connected' | 'error',
 *   error: { type: string, message?: string } | null,
 *   roomState: { participants: Array, chatHistory: Array } | null
 * }}
 */
export function useSocket({ roomId, userName, enabled = true }) {
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const [roomState, setRoomState] = useState(null);

  useEffect(() => {
    if (!enabled || !roomId || !userName) {
      return undefined;
    }

    // Vite-proxy отправит /socket.io на backend; query — параметры входа
    const socket = io({
      query: { roomId, userName },
      transports: ['websocket'],
      reconnectionAttempts: MAX_RETRIES,
      forceNew: true
    });
    socketRef.current = socket;
    setSocket(socket);
    setStatus('connecting');
    setError(null);

    socket.on('connect', () => {
      setStatus('connected');
    });

    // Сервер отклонил вход (валидация / room-full)
    socket.on('error', (payload) => {
      setError(payload || { type: 'unknown' });
      setStatus('error');
    });

    // Успешный вход: участники + история чата
    socket.on('room-joined', (payload) => {
      setRoomState({
        participants: payload.participants || [],
        chatHistory: payload.chatHistory || []
      });
    });

    // Сервер недоступен — после исчерпания попыток
    socket.on('connect_error', () => {
      if (socket.io._reconnectionAttempts >= MAX_RETRIES) {
        setError({ type: 'server-unavailable', message: 'Сервер недоступен' });
        setStatus('error');
      }
    });

    socket.io.on('reconnect_failed', () => {
      setError({ type: 'server-unavailable', message: 'Сервер недоступен' });
      setStatus('error');
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [roomId, userName, enabled]);

  return {
    socket,
    status,
    error,
    roomState
  };
}

export default useSocket;
