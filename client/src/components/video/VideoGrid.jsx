import { useMemo } from 'react';
import VideoTile from './VideoTile.jsx';

const EMPTY_MAP = new Map();

/**
 * Возвращает grid-классы для N участников.
 * 1 → 1 колонка, 2 → 1-2 колонки (адаптив), 3-4 → 2 колонки, 5-6 → 3 колонки.
 */
function getGridClass(count) {
  if (count <= 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-1 sm:grid-cols-2';
  if (count <= 4) return 'grid-cols-2';
  return 'grid-cols-2 lg:grid-cols-3';
}

/**
 * VideoGrid — адаптивная сетка видео-плиток.
 *
 * @param {object} props
 * @param {Array<{
 *   socketId: string,
 *   userName: string,
 *   isMuted?: boolean,
 *   isVideoOff?: boolean
 * }>} props.participants — удалённые участники
 * @param {MediaStream | null} props.localStream
 * @param {string} props.localUserName
 * @param {boolean} props.isLocalMuted
 * @param {boolean} props.isLocalVideoOff
 * @param {Map<string, MediaStream>} [props.remoteStreams] — удалённые потоки по socketId
 * @param {boolean} [props.audioUnlocked] — пользователь разблокировал autoplay (жест)
 */
function VideoGrid({
  participants = [],
  localStream = null,
  localUserName = '',
  isLocalMuted = false,
  isLocalVideoOff = false,
  remoteStreams = EMPTY_MAP,
  audioUnlocked = false
}) {
  const totalCount = participants.length + 1;
  const gridClass = getGridClass(totalCount);

  // Мемоизируем список удалённых плиток — не пересоздаём при ре-рендере
  // из-за изменений localStream
  const remoteTiles = useMemo(
    () =>
      participants.map((participant) => (
        <VideoTile
          key={participant.socketId}
          stream={remoteStreams.get(participant.socketId) || null}
          userName={participant.userName}
          isMuted={participant.isMuted || false}
          isVideoOff={participant.isVideoOff || false}
          isLocal={false}
          audioUnlocked={audioUnlocked}
        />
      )),
    [participants, remoteStreams, audioUnlocked]
  );

  return (
    <div className={`grid ${gridClass} gap-2 sm:gap-4 w-full h-full auto-rows-fr`}>
      {/* Локальный участник (self-view) */}
      <VideoTile
        key="local"
        stream={localStream}
        userName={localUserName}
        isMuted={isLocalMuted}
        isVideoOff={isLocalVideoOff}
        isLocal={true}
      />

      {/* Удалённые участники */}
      {remoteTiles}
    </div>
  );
}

export default VideoGrid;