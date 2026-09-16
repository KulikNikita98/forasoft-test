/**
 * AudioUnlockOverlay — оверлей для разблокировки воспроизведения удалённого аудио.
 * Браузеры блокируют autoplay без жеста пользователя (п.37): клик снимает блокировку.
 *
 * @param {object} props
 * @param {() => void} props.onUnlock — обработчик жеста пользователя
 */
function AudioUnlockOverlay({ onUnlock }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/70 text-center">
      <p className="max-w-md px-4 text-white">
        Нажмите, чтобы включить звук участников
      </p>
      <button
        type="button"
        onClick={onUnlock}
        className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
      >
        🔊 Включить звук
      </button>
    </div>
  );
}

export default AudioUnlockOverlay;
