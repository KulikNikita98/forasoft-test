import Button from '../common/Button.jsx';

/**
 * Controls — панель управления микрофоном, камерой и выходом из комнаты.
 *
 * @param {object} props
 * @param {boolean} props.isMicEnabled — состояние микрофона
 * @param {boolean} props.isVideoEnabled — состояние камеры
 * @param {() => void} props.onToggleMic — переключить микрофон
 * @param {() => void} props.onToggleVideo — переключить камеру
 * @param {() => void} props.onLeave — выйти из комнаты
 */
function Controls({ isMicEnabled, isVideoEnabled, onToggleMic, onToggleVideo, onLeave }) {
  return (
    <div className="flex items-center justify-center gap-4">
      {/* Кнопка микрофона */}
      <button
        onClick={onToggleMic}
        className={`rounded-full p-4 transition ${
          isMicEnabled
            ? 'bg-gray-700 hover:bg-gray-600'
            : 'bg-red-600 hover:bg-red-700'
        }`}
        title={isMicEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
        aria-label={isMicEnabled ? 'Выключить микрофон' : 'Включить микрофон'}
      >
        <span className="text-2xl" aria-hidden="true">
          {isMicEnabled ? '🎤' : '🔇'}
        </span>
      </button>

      {/* Кнопка камеры */}
      <button
        onClick={onToggleVideo}
        className={`rounded-full p-4 transition ${
          isVideoEnabled
            ? 'bg-gray-700 hover:bg-gray-600'
            : 'bg-red-600 hover:bg-red-700'
        }`}
        title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
        aria-label={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
      >
        <span className="text-2xl" aria-hidden="true">
          {isVideoEnabled ? '📹' : '📷'}
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
