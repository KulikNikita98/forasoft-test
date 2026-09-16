import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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

const LOCAL_ID = 'local';

/**
 * Нормализует участника с сервера: маппит mediaState в isMuted/isVideoOff.
 * Сервер отдаёт { socketId, userName, mediaState: { audio, video } },
 * а компоненты ожидают { isMuted, isVideoOff }.
 */
function normalizeParticipant(p) {
  const audio = p.mediaState?.audio ?? false;
  const video = p.mediaState?.video ?? false;
  return {
    ...p,
    isMuted: !audio,
    isVideoOff: !video
  };
}

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

  // Актуальный socket доступен в колбэках без пересоздания хуков
  const socketRef = useRef(null);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  // ---------------------------------------------------------------------------
  // Медиа
  // ---------------------------------------------------------------------------
  const {
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    hasAudioTrack,
    hasVideoTrack,
    error: mediaError,
    startMedia,
    stopMedia,
    toggleAudio,
    toggleVideo
  } = useMedia({
    onDeviceLost: (kind) => {
      // Устройство пропало во время звонка — сообщаем остальным
      const s = socketRef.current;
      if (!s) return;

      if (kind === 'audio') {
        s.emit('media-state', {
          audio: false,
          video: isVideoEnabled
        });
      } else if (kind === 'video') {
        s.emit('media-state', {
          audio: isAudioEnabled,
          video: false
        });
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Локальное состояние UI
  // ---------------------------------------------------------------------------
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [mediaErrorDismissed, setMediaErrorDismissed] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [connectionIssues, setConnectionIssues] = useState(new Map());

  // Показываем баннер, если есть хоть одна проблемная пара
  const connectionIssue = useMemo(() => {
    if (connectionIssues.size === 0) return null;
    // Приоритет: failed > disconnected
    const values = Array.from(connectionIssues.values());
    if (values.includes('failed')) return 'failed';
    if (values.includes('disconnected')) return 'disconnected';
    return null;
  }, [connectionIssues]);

  // ---------------------------------------------------------------------------
  // WebRTC
  // ---------------------------------------------------------------------------
  const { closeAllConnections } = useWebRTC({
    socket,
    localStream,
    onRemoteStream: (socketId, stream) => {
      setRemoteStreams((prev) => {
        // Не пересоздаём Map, если stream не изменился — важно для memo(VideoTile)
        if (prev.get(socketId) === stream) return prev;
        const next = new Map(prev);
        next.set(socketId, stream);
        return next;
      });
    },
    onPeerLeft: (socketId) => {
      setRemoteStreams((prev) => {
        if (!prev.has(socketId)) return prev;
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    },
    onConnectionStateChange: (socketId, state) => {
      setConnectionIssues((prev) => {
        const next = new Map(prev);
        if (state === 'failed' || state === 'disconnected') {
          next.set(socketId, state);
        } else if (
          state === 'connected' ||
          state === 'completed' ||
          state === 'closed'
        ) {
          next.delete(socketId);
        }
        return next;
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Полный список участников (локальный + удалённые)
  // ---------------------------------------------------------------------------
  const allParticipants = useMemo(() => {
    return [
      {
        socketId: LOCAL_ID,
        userName,
        isMuted: !isAudioEnabled,
        isVideoOff: !isVideoEnabled,
        isLocal: true
      },
      ...participants
    ];
  }, [userName, isAudioEnabled, isVideoEnabled, participants]);

  // ---------------------------------------------------------------------------
  // Инициализация из roomState (первый room-joined)
  // ---------------------------------------------------------------------------
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!roomState) return;

    if (!initializedRef.current) {
      initializedRef.current = true;
      setParticipants((roomState.participants || []).map(normalizeParticipant));
      setMessages(roomState.chatHistory || []);
    } else {
      // Реконнект: не затираем накопленную историю чата
      setParticipants((prev) => {
        const byId = new Map(prev.map((p) => [p.socketId, p]));
        (roomState.participants || []).forEach((p) => {
          if (!byId.has(p.socketId)) byId.set(p.socketId, normalizeParticipant(p));
        });
        return Array.from(byId.values());
      });
    }
  }, [roomState]);

  // ---------------------------------------------------------------------------
  // Socket-события: участники
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!socket) return undefined;

    const onUserJoined = (participant) => {
      setParticipants((prev) => {
        if (prev.some((p) => p.socketId === participant.socketId)) return prev;
        return [...prev, normalizeParticipant(participant)];
      });
    };

    const onUserLeft = ({ socketId }) => {
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    };

    const onMediaStateChanged = ({ socketId, mediaState }) => {
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.socketId !== socketId) return p;
          return {
            ...p,
            isMuted: !mediaState.audio,
            isVideoOff: !mediaState.video
          };
        })
      );
    };

    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('media-state-changed', onMediaStateChanged);

    return () => {
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
      socket.off('media-state-changed', onMediaStateChanged);
    };
  }, [socket]);

  // ---------------------------------------------------------------------------
  // Socket-события: чат
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Сброс баннера ошибки медиа при новой ошибке
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (mediaError) setMediaErrorDismissed(false);
  }, [mediaError]);

  // ---------------------------------------------------------------------------
  // Хэндлеры
  // ---------------------------------------------------------------------------
  const handleSendMessage = useCallback(
    (text) => {
      if (!text || !text.trim()) return;
      socketRef.current?.emit('chat-message', { message: text });
    },
    []
  );

  // Гарантирует наличие потока. initialState задаёт, какие треки должны быть
  // включены сразу после захвата — иначе getUserMedia поднимет оба трека enabled.
  const ensureMedia = useCallback(async (initialState) => {
    if (localStream) return true;
    const stream = await startMedia({ initialState });
    return Boolean(stream);
  }, [localStream, startMedia]);

  const handleToggleMic = useCallback(async () => {
    const next = !isAudioEnabled;
    // Первый захват: включаем только запрошенное устройство, видео — как сейчас
    const ok = await ensureMedia({ audio: next, video: isVideoEnabled });
    if (!ok) return;

    toggleAudio(next);

    socketRef.current?.emit('media-state', {
      audio: next,
      video: isVideoEnabled
    });
  }, [ensureMedia, isAudioEnabled, isVideoEnabled, toggleAudio]);

  const handleToggleVideo = useCallback(async () => {
    const next = !isVideoEnabled;
    const ok = await ensureMedia({ audio: isAudioEnabled, video: next });
    if (!ok) return;

    toggleVideo(next);

    socketRef.current?.emit('media-state', {
      audio: isAudioEnabled,
      video: next
    });
  }, [ensureMedia, isAudioEnabled, isVideoEnabled, toggleVideo]);

  const handleLeave = useCallback(() => {
    // Явно останавливаем треки, чтобы камера/микрофон погасли до unmount
    stopMedia();
    closeAllConnections();

    const s = socketRef.current;
    if (s) {
      s.emit('leave-room');
      s.disconnect();
    }

    navigate('/');
  }, [stopMedia, closeAllConnections, navigate]);

  const handleUnlockAudio = useCallback(() => {
    setAudioUnlocked(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Ранние возвраты (после всех хуков!)
  // ---------------------------------------------------------------------------
  if (!userName) {
    return <NamePrompt onSubmit={setUserName} />;
  }

  if (status === 'error' && error) {
    return <RoomError error={error} />;
  }

  // ---------------------------------------------------------------------------
  // Рендер
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-screen flex-col bg-gray-900 text-white">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 px-4 py-3">
        <h1 className="text-lg font-semibold">
          Комната <span className="text-sm text-gray-400">{roomId}</span>
        </h1>
        <InviteButton roomId={roomId} />
      </header>

      {mediaError && !mediaErrorDismissed && (
        <MediaErrorBanner
          message={mediaError}
          onDismiss={() => setMediaErrorDismissed(true)}
        />
      )}

      <ConnectionStatusBanner state={connectionIssue} />

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        <main className="relative flex flex-1 items-center justify-center p-4 min-h-0">
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
              audioUnlocked={audioUnlocked}
            />
          )}

          {status === 'connected' && participants.length > 0 && !audioUnlocked && (
            <AudioUnlockOverlay onUnlock={handleUnlockAudio} />
          )}
        </main>

        <aside className="flex w-full md:w-72 shrink-0 flex-col gap-4 border-t md:border-t-0 md:border-l border-gray-800 p-4 max-h-64 md:max-h-none min-h-0 overflow-hidden">
          <div className="shrink-0">
            <ParticipantList
              participants={allParticipants}
              currentUserName={userName}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <Chat
              messages={messages}
              onSend={handleSendMessage}
              currentSocketId={socket?.id}
            />
          </div>
        </aside>
      </div>

      <footer className="shrink-0 border-t border-gray-800 px-4 py-3">
        <Controls
          isMicEnabled={isAudioEnabled}
          isVideoEnabled={isVideoEnabled}
          hasMediaError={!!mediaError}
          hasAudioTrack={hasAudioTrack}
          hasVideoTrack={hasVideoTrack}
          onToggleMic={handleToggleMic}
          onToggleVideo={handleToggleVideo}
          onLeave={handleLeave}
        />
      </footer>
    </div>
  );
}

export default RoomScreen;