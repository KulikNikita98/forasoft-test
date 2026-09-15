/**
 * Проверка поддержки WebRTC браузером.
 * getUserMedia и RTCPeerConnection требуются для видеозвонка.
 * @returns {boolean}
 */
export function isWebRTCSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof window.RTCPeerConnection !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}
