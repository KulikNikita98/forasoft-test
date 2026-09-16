import Button from '../common/Button.jsx';

/**
 * Controls — панель управления микрофоном, камерой и выходом из комнаты.
 *
 * @param {object} props
 * @param {boolean} props.isMicEnabled — состояние микрофона
 * @param {boolean} props.isVideoEnabled — состояние камеры
 * @param {boolean} props.hasMediaError — есть ли ошибка доступа к устройствам
 * @param {() => void} props.onToggleMic — переключить микрофон
 * @param {() => void} props.onToggleVideo — переключить камеру
 * @param {() => void} props.onLeave — выйти из комнаты
 */
function Controls({ isMicEnabled, isVideoEnabled, hasMediaError, onToggleMic, onToggleVideo, onLeave }) {
  return (
    <div className="flex items-center justify-center gap-4">
      {/* Кнопка микрофона */}
      <button
        onClick={onToggleMic}
        disabled={hasMediaError}
        className={`rounded-full p-4 transition ${
          hasMediaError
            ? 'bg-gray-800 cursor-not-allowed opacity-50'
            : isMicEnabled
            ? 'bg-gray-700 hover:bg-gray-600'
            : 'bg-red-600 hover:bg-red-700'
        }`}
        title={hasMediaError ? 'Устройство недоступно' : isMicEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
        aria-label={hasMediaError ? 'Устройство недоступно' : isMicEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
      >
        <span className="text-2xl" aria-hidden="true">
          {hasMediaError ? '🚫' : isMicEnabled ? '🎤' : '🔇'}
        </span>
      </button>

      {/* Кнопка камеры */}
      <button
        onClick={onToggleVideo}
        disabled={hasMediaError}
        className={`rounded-full p-4 transition ${
          hasMediaError
            ? 'bg-gray-800 cursor-not-allowed opacity-50'
            : isVideoEnabled
            ? 'bg-gray-700 hover:bg-gray-600'
            : 'bg-red-600 hover:bg-red-700'
        }`}
        title={hasMediaError ? 'Устройство недоступно' : isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
        aria-label={hasMediaError ? 'Устройство недоступно' : isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
      >
        <span className="text-2xl" aria-hidden="true">
          {hasMediaError ? '🚫' : isVideoEnabled ? '📹' : '📷'}
        </span>
      </button>

      {/* Кнопка выхода */}
      <Button variant="danger" onClick={onLeave}>
        Выйти
      </Button>
    </div>
  );
}

export default Controls;
