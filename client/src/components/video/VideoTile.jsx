import { memo, useEffect, useRef } from 'react';

/**
 * VideoTile — плитка одного участника с видео, overlay и индикаторами.
 * Обернут в React.memo для оптимизации (NFR-PERF).
 *
 * @param {object} props
 * @param {MediaStream | null} props.stream — видеопоток участника
 * @param {string} props.userName — имя для overlay
 * @param {boolean} props.isMuted — показать иконку выключенного микрофона
 * @param {boolean} props.isVideoOff — показать заглушку вместо видео
 * @param {boolean} props.isLocal — флаг self-view
 */
function VideoTile({ stream, userName, isMuted = false, isVideoOff = false, isLocal = false }) {
  const videoRef = useRef(null);

  // Привязываем stream к video элементу
  useEffect(() => {
    if (videoRef.current && stream && !isVideoOff) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isVideoOff]);

  const showPlaceholder = !stream || isVideoOff;

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg bg-gray-900">
      {/* Video element */}
      {!showPlaceholder && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="h-full w-full object-cover"
        />
      )}

      {/* Placeholder при отсутствии видео */}
      {showPlaceholder && (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gray-800">
          <div className="mb-3 text-6xl">👤</div>
          <div className="text-lg font-semibold text-white">{userName}</div>
        </div>
      )}

      {/* Overlay с именем */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-medium text-white">
            {userName}
            {isLocal && <span className="ml-1 text-xs text-gray-300">(вы)</span>}
          </span>

          {/* Индикатор выключенного микрофона */}
          {isMuted && (
            <span className="ml-2 text-lg" title="Микрофон выключен" aria-label="Микрофон выключен">
              🔇
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Оптимизация: не ре-рендерить если props не изменились
export default memo(VideoTile);
