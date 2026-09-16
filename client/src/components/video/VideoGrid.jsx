import VideoTile from './VideoTile.jsx';

/**
 * VideoGrid — адаптивная сетка видео-плиток для 1-4 участников.
 * Динамическая раскладка: 1×1, 1×2, 2×2.
 *
 * @param {object} props
 * @param {Array<{socketId, userName, stream, isMuted, isVideoOff}>} props.participants
 * @param {MediaStream | null} props.localStream
 * @param {string} props.localUserName
 * @param {boolean} props.isLocalMuted
 * @param {boolean} props.isLocalVideoOff
 */
function VideoGrid({
  participants = [],
  localStream = null,
  localUserName = '',
  isLocalMuted = false,
  isLocalVideoOff = false
}) {
  const totalCount = participants.length + 1; // +1 для локального участника

  // Динамическая раскладка сетки
  const getGridClass = (count) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2';
    return 'grid-cols-2'; // 3-4 participants
  };

  const gridClass = getGridClass(totalCount);

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {/* Локальный участник (self-view) */}
      <VideoTile
        key="local"
        stream={localStream}
        userName={localUserName}
        isMuted={isLocalMuted}
        isVideoOff={isLocalVideoOff}
        isLocal={true}
      />

      {/* Удаленные участники */}
      {participants.map((participant) => (
        <VideoTile
          key={participant.socketId}
          stream={participant.stream || null}
          userName={participant.userName}
          isMuted={participant.isMuted || false}
          isVideoOff={participant.isVideoOff || false}
          isLocal={false}
        />
      ))}
    </div>
  );
}

export default VideoGrid;
