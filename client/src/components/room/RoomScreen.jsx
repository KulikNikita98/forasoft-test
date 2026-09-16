import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket.js';
import { useMedia } from '../../hooks/useMedia.js';
import { useWebRTC } from '../../hooks/useWebRTC.js';
import NamePrompt from './NamePrompt.jsx';
import RoomError from './RoomError.jsx';
import InviteButton from './InviteButton.jsx';
import MediaErrorBanner from './MediaErrorBanner.jsx';
import AudioUnlockOverlay from './AudioUnlockOverlay.jsx';
import ConnectionStatusBanner from './ConnectionStatusBanner.jsx';
import { ParticipantList } from '../participant/index.js';
import { VideoGrid } from '../video/index.js';
import { Controls } from '../controls/index.js';
import { Chat } from '../chat/index.js';

/**
 * RoomScreen — экран комнаты. Координирует подключение и дочерние компоненты:
 * видеосетку, чат, список участников и панель управления.
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

  const {
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    error: mediaError,
    startMedia,
    toggleAudio,
    toggleVideo
  } = useMedia();

  // Список участников в реальном времени
  const [participants, setParticipants] = useState([]);

  // Сообщения чата (user + system)
  const [messages, setMessages] = useState([]);

  // Показ баннера ошибки медиа (можно закрыть)
  const [mediaErrorDismissed, setMediaErrorDismissed] = useState(false);

  // Разблокировка remote audio (autoplay policy). Показываем оверлей, пока есть удалённые участники.
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  // Удалённые потоки: Map<socketId, MediaStream>
  const [remoteStreams, setRemoteStreams] = useState(new Map());

  // Проблема с P2P-соединением ('disconnected' | 'failed' | null)
  const [connectionIssue, setConnectionIssue] = useState(null);

  // WebRTC: создание P2P соединений с участниками
  useWebRTC({
    socket,
    localStream,
    onRemoteStream: (socketId, stream) => {
      setRemoteStreams((prev) => new Map(prev).set(socketId, stream));
    },
    onPeerLeft: (socketId) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    },
    onConnectionStateChange: (socketId, state) => {
      if (state === 'failed' || state === 'disconnected') {
        setConnectionIssue(state);
      } else if (state === 'connected' || state === 'completed') {
        setConnectionIssue(null);
      }
    }
  });

  // Запуск локального потока при успешном подключении
  useEffect(() => {
    if (status === 'connected') {
      startMedia();
    }
  }, [status]);

  // Инициализация списка участников и истории чата из room-joined
  useEffect(() => {
    if (roomState) {
      setParticipants(roomState.participants);
      setMessages(roomState.chatHistory);
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

  // Приём сообщений чата и системных событий
  useEffect(() => {
    if (!socket) return undefined;

    const onChatMessage = (msg) => {
      setMessages((prev) => [...prev, { ...msg, type: 'user' }]);
    };
    const onSystemMessage = (msg) => {
      setMessages((prev) => [...prev, { ...msg, type: 'system' }]);
    };

    socket.on('chat-message', onChatMessage);
    socket.on('system-message', onSystemMessage);

    return () => {
      socket.off('chat-message', onChatMessage);
      socket.off('system-message', onSystemMessage);
    };
  }, [socket]);

  const handleSendMessage = (text) => {
    if (socket) {
      socket.emit('chat-message', { message: text });
    }
  };

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

  const handleUnlockAudio = () => {
    setAudioUnlocked(true);
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
      <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <h1 className="text-lg font-semibold">Комната</h1>
        <InviteButton />
      </header>

      {mediaError && !mediaErrorDismissed && (
        <MediaErrorBanner
          message={mediaError}
          onDismiss={() => setMediaErrorDismissed(true)}
        />
      )}

      <ConnectionStatusBanner state={connectionIssue} />

      <div className="flex flex-1 overflow-hidden">
        <main className="relative flex flex-1 items-center justify-center p-4">
          {status === 'connecting' ? (
            <div className="text-gray-500">Подключение...</div>
          ) : (
            <VideoGrid
              participants={participants}
              localStream={localStream}
              localUserName={userName}
              isLocalMuted={!isAudioEnabled}
              isLocalVideoOff={!isVideoEnabled}
              remoteStreams={remoteStreams}
            />
          )}

          {status === 'connected' && participants.length > 0 && !audioUnlocked && (
            <AudioUnlockOverlay onUnlock={handleUnlockAudio} />
          )}
        </main>

        <aside className="flex w-72 flex-col gap-4 border-l border-gray-800 p-4">
          <ParticipantList participants={participants} currentUserName={userName} />
          <div className="min-h-0 flex-1">
            <Chat
              messages={messages}
              onSend={handleSendMessage}
              currentSocketId={socket?.id}
            />
          </div>
        </aside>
      </div>

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
