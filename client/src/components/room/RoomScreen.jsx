import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket.js';
import { useMedia } from '../../hooks/useMedia.js';
import NamePrompt from './NamePrompt.jsx';
import RoomError from './RoomError.jsx';
import InviteButton from './InviteButton.jsx';
import { ParticipantList } from '../participant/index.js';
import { VideoGrid } from '../video/index.js';
import { Controls } from '../controls/index.js';

/**
 * RoomScreen — экран комнаты. Координирует подключение и дочерние компоненты.
 * Видеосетка (задача 12), чат (задача 16), панель управления (задача 15).
 */
function RoomScreen() {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Имя из navigation state (пришли со StartScreen) или запросим через NamePrompt
  const [userName, setUserName] = useState(location.state?.userName || '');

  const { socket, status, error, roomState } = useSocket({
    roomId,
    userName,
    enabled: Boolean(userName)
  });

  // Локальные медиа-устройства (задача 13)
  const { localStream, isAudioEnabled, isVideoEnabled, startMedia, toggleAudio, toggleVideo } = useMedia();

  // Список участников в реальном времени
  const [participants, setParticipants] = useState([]);

  // Запуск локального потока при успешном подключении
  useEffect(() => {
    if (status === 'connected') {
      startMedia();
    }
  }, [status]);

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

  // Обработчики Controls
  const handleToggleMic = () => {
    toggleAudio();
    if (socket) {
      socket.emit('media-state', { kind: 'audio', enabled: !isAudioEnabled });
    }
  };

  const handleToggleVideo = () => {
    toggleVideo();
    if (socket) {
      socket.emit('media-state', { kind: 'video', enabled: !isVideoEnabled });
    }
  };

  const handleLeave = () => {
    if (socket) {
      socket.emit('leave-room');
      socket.disconnect();
    }
    navigate('/');
  };

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
          {status === 'connecting' ? (
            <div className="text-gray-500">Подключение...</div>
          ) : (
            <VideoGrid
              participants={participants}
              localStream={localStream}
              localUserName={userName}
              isLocalMuted={!isAudioEnabled}
              isLocalVideoOff={!isVideoEnabled}
            />
          )}
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
      <footer className="border-t border-gray-800 px-4 py-3">
        <Controls
          isMicEnabled={isAudioEnabled}
          isVideoEnabled={isVideoEnabled}
          onToggleMic={handleToggleMic}
          onToggleVideo={handleToggleVideo}
          onLeave={handleLeave}
        />
      </footer>
    </div>
  );
}

export default RoomScreen;
