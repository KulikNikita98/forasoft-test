import { memo, useEffect, useRef, useState } from 'react';

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
 * @param {boolean} props.audioUnlocked — пользователь разблокировал autoplay жестом
 */
function VideoTile({
  stream,
  userName,
  isMuted = false,
  isVideoOff = false,
  isLocal = false,
  audioUnlocked = false
}) {
  const videoRef = useRef(null);

  // Реально ли видео воспроизводится (есть кадры). Определяется по событиям
  // video-элемента, а не по track.enabled — у удалённого трека enabled ненадёжен.
  const [isPlaying, setIsPlaying] = useState(false);

  // Есть ли вообще видео-трек в потоке (может добавиться позже через re-negotiation)
  const [hasVideoTrack, setHasVideoTrack] = useState(false);

  // Привязываем stream к video элементу
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    // Если потока нет — явно очищаем srcObject
    if (!stream) {
      if (video.srcObject) video.srcObject = null;
      setIsPlaying(false);
      setHasVideoTrack(false);
      return undefined;
    }

    // Привязываем поток, только если он ещё не привязан (избегаем перезапуска)
    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    // Начальное значение muted (управляем императивно, не через JSX):
    // - локальное видео всегда muted (не слышим себя, эхо)
    // - удалённое muted до user gesture, потом снимается в эффекте audioUnlocked
    video.muted = isLocal || !audioUnlocked;

    // Не ждём promise от play(): у WebRTC-трека до прихода кадров он может не
    // разрешиться. Реальное состояние отслеживаем через события 'playing'/'pause'.
    let cancelled = false;
    const attemptPlay = () => {
      video.play()?.catch((err) => {
        if (cancelled || err.name === 'AbortError') return;
        // Autoplay без жеста разрешён только для muted
        video.muted = true;
        video.play()?.catch(() => {});
      });
    };
    attemptPlay();

    // Отслеживаем реальное состояние воспроизведения через события video
    const onPlaying = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEmptied = () => setIsPlaying(false);
    const onLoadedMetadata = () => attemptPlay();

    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('emptied', onEmptied);
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    // Отслеживаем наличие видео-трека в потоке
    const updateHasVideoTrack = () => {
      const track = stream.getVideoTracks()[0];
      setHasVideoTrack(Boolean(track && track.readyState === 'live'));
      // При добавлении трека повторяем попытку воспроизведения
      if (track) attemptPlay();
    };
    updateHasVideoTrack();

    stream.addEventListener('addtrack', updateHasVideoTrack);
    stream.addEventListener('removetrack', updateHasVideoTrack);

    const videoTrack = stream.getVideoTracks()[0];
    // 'unmute' срабатывает, когда в удалённый трек начинают поступать реальные
    // кадры. У WebRTC-треков это ключевой момент — до него video не имеет данных
    // и play() может зависнуть. Перезапускаем воспроизведение здесь.
    const onTrackUnmute = () => {
      updateHasVideoTrack();
      attemptPlay();
    };
    if (videoTrack) {
      videoTrack.addEventListener('ended', updateHasVideoTrack);
      videoTrack.addEventListener('mute', updateHasVideoTrack);
      videoTrack.addEventListener('unmute', onTrackUnmute);
    }

    return () => {
      cancelled = true;
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('emptied', onEmptied);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      stream.removeEventListener('addtrack', updateHasVideoTrack);
      stream.removeEventListener('removetrack', updateHasVideoTrack);
      if (videoTrack) {
        videoTrack.removeEventListener('ended', updateHasVideoTrack);
        videoTrack.removeEventListener('mute', updateHasVideoTrack);
        videoTrack.removeEventListener('unmute', onTrackUnmute);
      }
    };
    // isLocal/audioUnlocked намеренно вне deps: начальный muted ставится один раз
    // при привязке потока, изменения audioUnlocked обрабатывает эффект ниже.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream, userName]);

  // Жест пользователя снимает autoplay-блокировку: возвращаем звук удалённому видео.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream || isLocal || !audioUnlocked) return;

    video.muted = false;
    video.play()?.catch(() => {});
  }, [audioUnlocked, stream, isLocal]);

  // Плитка показывает видео, если:
  // 1. есть живой видео-трек И идёт реальное воспроизведение (isPlaying), И
  // 2. участник не выключил камеру через media-state (isVideoOff)
  //
  // isPlaying — источник правды о реальных кадрах (учитывает autoplay policy).
  // isVideoOff — сигнал о toggle через track.enabled, который не виден получателю иначе.
  const showPlaceholder = !hasVideoTrack || !isPlaying || isVideoOff;

  return (
    <div
      className="relative w-full aspect-video overflow-hidden rounded-lg bg-gray-900"
      aria-label={`Видео участника ${userName}`}
      role="img"
    >
      {/* Video element — всегда в DOM, скрыт через opacity при placeholder.
          muted управляем императивно в эффектах (JSX-проп конфликтовал бы с
          autoplay-fallback): локальное видео всегда muted, удалённое —
          muted до user gesture (audioUnlocked), затем со звуком. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`absolute inset-0 h-full w-full object-cover transition-opacity ${
          showPlaceholder ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      />

      {/* Placeholder при отсутствии видео */}
      {showPlaceholder && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
          <div className="mb-3 text-6xl" aria-hidden="true">👤</div>
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

          {isMuted && (
            <span
              className="ml-2 text-lg"
              title="Микрофон выключен"
              aria-label="Микрофон выключен"
              role="img"
            >
              🔇
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Кастомное сравнение props: MediaStream сравниваем по id,
// чтобы renegotiation без смены треков не вызывал ре-рендер
function areEqual(prev, next) {
  return (
    prev.userName === next.userName &&
    prev.isMuted === next.isMuted &&
    prev.isVideoOff === next.isVideoOff &&
    prev.isLocal === next.isLocal &&
    prev.audioUnlocked === next.audioUnlocked &&
    (prev.stream?.id ?? null) === (next.stream?.id ?? null)
  );
}

export default memo(VideoTile, areEqual);