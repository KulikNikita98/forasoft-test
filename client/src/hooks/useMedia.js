import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useMedia — управление локальными медиа-устройствами (камера/микрофон).
 *
 * @param {object} options
 * @param {boolean} options.autoStart - автоматически запрашивать getUserMedia при монтировании
 * @param {(kind: 'audio' | 'video') => void} [options.onDeviceLost] - устройство пропало во время звонка
 * @param {MediaStreamConstraints} [options.constraints] - кастомные constraints
 * @returns {{
 *   localStream: MediaStream | null,
 *   isAudioEnabled: boolean,
 *   isVideoEnabled: boolean,
 *   hasAudioTrack: boolean,
 *   hasVideoTrack: boolean,
 *   error: string | null,
 *   startMedia: (options?: { constraints?: MediaStreamConstraints, initialState?: { audio?: boolean, video?: boolean } }) => Promise<MediaStream | null>,
 *   stopMedia: () => void,
 *   toggleAudio: (enabled?: boolean) => void,
 *   toggleVideo: (enabled?: boolean) => void,
 *   replaceVideoTrack: (newTrack: MediaStreamTrack) => Promise<void>
 * }}
 */
export function useMedia({
  autoStart = false,
  onDeviceLost,
  constraints: initialConstraints
} = {}) {
  const [localStream, setLocalStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [hasAudioTrack, setHasAudioTrack] = useState(false);
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  const [error, setError] = useState(null);

  const streamRef = useRef(null);
  const isInitializedRef = useRef(false);
  const mountedRef = useRef(true);

  const defaultConstraints = useRef({
    audio: true,
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    }
  });

  const onDeviceLostRef = useRef(onDeviceLost);
  useEffect(() => {
    onDeviceLostRef.current = onDeviceLost;
  }, [onDeviceLost]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ---------------------------------------------------------------------------
  // Потеря устройства во время звонка
  // ---------------------------------------------------------------------------
  const handleTrackEnded = useCallback((kind) => {
    const stream = streamRef.current;
    if (!stream) return;

    if (kind === 'audio') {
      setIsAudioEnabled(false);
      setHasAudioTrack(false);
      stream.getAudioTracks().forEach((t) => {
        stream.removeTrack(t);
      });
    } else if (kind === 'video') {
      setIsVideoEnabled(false);
      setHasVideoTrack(false);
      stream.getVideoTracks().forEach((t) => {
        stream.removeTrack(t);
      });
    }

    // Триггерим обновление, чтобы useWebRTC увидел изменения через replaceTrack/removeTrack
    setLocalStream(stream);

    if (onDeviceLostRef.current) {
      onDeviceLostRef.current(kind);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // startMedia
  // ---------------------------------------------------------------------------
  const startMedia = useCallback(async (options = {}) => {
    const { constraints: overrideConstraints, initialState } = options;
    try {
      setError(null);

      // Останавливаем предыдущий поток, если был
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const constraints = overrideConstraints
        || initialConstraints
        || defaultConstraints.current;

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return null;
      }

      streamRef.current = stream;

      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      // getUserMedia отдаёт оба трека enabled=true. Выставляем enabled согласно
      // намерению пользователя: включил только микрофон — видео стартует выключенным.
      if (initialState) {
        if (audioTrack && typeof initialState.audio === 'boolean') {
          audioTrack.enabled = initialState.audio;
        }
        if (videoTrack && typeof initialState.video === 'boolean') {
          videoTrack.enabled = initialState.video;
        }
      }

      setLocalStream(stream);
      setHasAudioTrack(!!audioTrack);
      setHasVideoTrack(!!videoTrack);
      setIsAudioEnabled(audioTrack?.enabled ?? false);
      setIsVideoEnabled(videoTrack?.enabled ?? false);

      if (audioTrack) {
        audioTrack.onended = () => handleTrackEnded('audio');
      }
      if (videoTrack) {
        videoTrack.onended = () => handleTrackEnded('video');
      }

      return stream;
    } catch (err) {
      let errorMessage = 'Не удалось получить доступ к устройствам';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Доступ к камере/микрофону отклонен';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'Камера или микрофон не найдены';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Устройство уже используется (закройте другие вкладки с видеозвонками)';
      } else if (err.name === 'AbortError') {
        errorMessage = 'Устройство занято другим приложением или вкладкой';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Устройство не поддерживает запрошенные параметры';
      }

      if (mountedRef.current) setError(errorMessage);
      return null;
    }
  }, [initialConstraints, handleTrackEnded]);

  // ---------------------------------------------------------------------------
  // stopMedia
  // ---------------------------------------------------------------------------
  const stopMedia = useCallback(() => {
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      streamRef.current = null;
    }

    if (mountedRef.current) {
      setLocalStream(null);
      setIsAudioEnabled(false);
      setIsVideoEnabled(false);
      setHasAudioTrack(false);
      setHasVideoTrack(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // toggle
  // ---------------------------------------------------------------------------
  const toggleAudio = useCallback((enabled) => {
    const stream = streamRef.current;
    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const newState = enabled !== undefined ? enabled : !audioTrack.enabled;
    audioTrack.enabled = newState;
    setIsAudioEnabled(newState);
  }, []);

  const toggleVideo = useCallback((enabled) => {
    const stream = streamRef.current;
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    const newState = enabled !== undefined ? enabled : !videoTrack.enabled;
    videoTrack.enabled = newState;
    setIsVideoEnabled(newState);
  }, []);

  // ---------------------------------------------------------------------------
  // Замена видеотрека (например, переключение камеры)
  // ---------------------------------------------------------------------------
  const replaceVideoTrack = useCallback(async (newTrack) => {
    const stream = streamRef.current;
    if (!stream || !newTrack) return;

    const oldTrack = stream.getVideoTracks()[0];
    if (oldTrack) {
      oldTrack.onended = null;
      oldTrack.stop();
      stream.removeTrack(oldTrack);
    }

    stream.addTrack(newTrack);
    newTrack.onended = () => handleTrackEnded('video');

    setLocalStream(stream);
    setHasVideoTrack(true);
    setIsVideoEnabled(newTrack.enabled);
  }, [handleTrackEnded]);

  // ---------------------------------------------------------------------------
  // Автостарт + cleanup
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (autoStart && !isInitializedRef.current) {
      isInitializedRef.current = true;
      startMedia();
    }

    return () => {
      const stream = streamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.onended = null;
          track.stop();
        });
        streamRef.current = null;
      }
    };
  }, [autoStart, startMedia]);

  return {
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    hasAudioTrack,
    hasVideoTrack,
    error,
    startMedia,
    stopMedia,
    toggleAudio,
    toggleVideo,
    replaceVideoTrack
  };
}

export default useMedia;