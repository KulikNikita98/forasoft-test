/**
 * MediaErrorBanner — баннер об ошибке доступа к камере/микрофону.
 * Пользователь остаётся в комнате с выключенными устройствами (п.33).
 *
 * @param {object} props
 * @param {string} props.message — текст ошибки
 * @param {() => void} [props.onDismiss] — закрыть баннер
 */
function MediaErrorBanner({ message, onDismiss }) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 bg-amber-600/90 px-4 py-2 text-sm text-white"
    >
      <span>
        <span className="mr-2" aria-hidden="true">⚠️</span>
        {message}. Вы в комнате с выключенными устройствами.
      </span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Закрыть уведомление"
          className="rounded px-2 text-lg leading-none text-white/80 transition hover:text-white"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default MediaErrorBanner;
