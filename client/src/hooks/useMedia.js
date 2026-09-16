import { useState, useEffect, useRef } from 'react';

/**
 * useMedia — управление локальными медиа-устройствами (камера/микрофон).
 *
 * @param {object} options
 * @param {boolean} options.autoStart - автоматически запрашивать getUserMedia при монтировании
 * @returns {{
 *   localStream: MediaStream | null,
 *   isAudioEnabled: boolean,
 *   isVideoEnabled: boolean,
 *   error: string | null,
 *   startMedia: () => Promise<void>,
 *   stopMedia: () => void,
 *   toggleAudio: (enabled?: boolean) => void,
 *   toggleVideo: (enabled?: boolean) => void
 * }}
 */
export function useMedia({ autoStart = false } = {}) {
  const [localStream, setLocalStream] = useState(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);

  // Дефолтные constraints: 720p @ 30fps (NFR-PERF)
  const constraints = {
    audio: true,
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 }
    }
  };

  const startMedia = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      streamRef.current = stream;
      setLocalStream(stream);

      // Проверяем, какие треки реально получены
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      setIsAudioEnabled(audioTrack?.enabled ?? false);
      setIsVideoEnabled(videoTrack?.enabled ?? false);
    } catch (err) {
      let errorMessage = 'Не удалось получить доступ к устройствам';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Доступ к камере/микрофону отклонен';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMessage = 'Камера или микрофон не найдены';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMessage = 'Устройство используется другим приложением';
      }

      setError(errorMessage);
      console.error('getUserMedia error:', err);
    }
  };

  const stopMedia = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      setLocalStream(null);
    }
  };

  const toggleAudio = (enabled) => {
    if (!streamRef.current) return;

    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      const newState = enabled !== undefined ? enabled : !isAudioEnabled;
      audioTrack.enabled = newState;
      setIsAudioEnabled(newState);
    }
  };

  const toggleVideo = (enabled) => {
    if (!streamRef.current) return;

    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      const newState = enabled !== undefined ? enabled : !isVideoEnabled;
      videoTrack.enabled = newState;
      setIsVideoEnabled(newState);
    }
  };

  useEffect(() => {
    if (autoStart) {
      startMedia();
    }

    return () => {
      stopMedia();
    };
  }, [autoStart]);

  return {
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    error,
    startMedia,
    stopMedia,
    toggleAudio,
    toggleVideo
  };
}

export default useMedia;
