import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket.js';
import NamePrompt from './NamePrompt.jsx';
import RoomError from './RoomError.jsx';
import ParticipantList from './ParticipantList.jsx';
import InviteButton from './InviteButton.jsx';

/**
 * RoomScreen — экран комнаты. Координирует подключение и дочерние компоненты.
 * Видеосетка (задача 12), чат (задача 16), панель управления (задача 15)
 * пока представлены заглушками.
 */
function RoomScreen() {
  const { roomId } = useParams();
  const location = useLocation();

  // Имя из navigation state (пришли со StartScreen) или запросим через NamePrompt
  const [userName, setUserName] = useState(location.state?.userName || '');

  const { socket, status, error, roomState } = useSocket({
    roomId,
    userName,
    enabled: Boolean(userName)
  });

  // Список участников в реальном времени
  const [participants, setParticipants] = useState([]);

  // Инициализация списка из room-joined
  useEffect(() => {
    if (roomState) {
      setParticipants(roomState.participants);
    }
  }, [roomState]);

  // Обновление участников через user-joined / user-left
  useEffect(() => {
    if (!socket) return undefined;

    const onUserJoined = (participant) => {
      setParticipants((prev) => [...prev, participant]);
    };
    const onUserLeft = ({ socketId }) => {
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    };

    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);

    return () => {
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
    };
  }, [socket]);

  // Прямой вход по ссылке без имени — запросить имя
  if (!userName) {
    return <NamePrompt onSubmit={setUserName} />;
  }

  // Ошибка входа (комната заполнена / сервер недоступен)
  if (status === 'error' && error) {
    return <RoomError error={error} />;
  }

  return (
    <div className="flex h-screen flex-col bg-gray-900 text-white">
      {/* Заголовок с приглашением */}
      <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <h1 className="text-lg font-semibold">Комната</h1>
        <InviteButton />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Основная область: видеосетка (задача 12) */}
        <main className="flex flex-1 items-center justify-center p-4">
          <div className="text-gray-500">
            {status === 'connecting'
              ? 'Подключение...'
              : 'Видеосетка (в разработке — задача 12)'}
          </div>
        </main>

        {/* Боковая панель: участники + чат (задача 16) */}
        <aside className="flex w-72 flex-col gap-4 border-l border-gray-800 p-4">
          <ParticipantList participants={participants} currentUserName={userName} />
          <div className="flex-1 text-sm text-gray-500">
            Чат (в разработке — задача 16)
          </div>
        </aside>
      </div>

      {/* Панель управления (задача 15) */}
      <footer className="border-t border-gray-800 px-4 py-3 text-center text-sm text-gray-500">
        Панель управления (в разработке — задача 15)
      </footer>
    </div>
  );
}

export default RoomScreen;
