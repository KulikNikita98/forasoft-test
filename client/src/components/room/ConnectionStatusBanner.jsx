/**
 * ConnectionStatusBanner — индикатор проблем с P2P-соединением.
 *
 * @param {object} props
 * @param {'disconnected' | 'failed' | null} props.state
 */
function ConnectionStatusBanner({ state }) {
  if (!state) return null;

  const isFailed = state === 'failed';
  const message = isFailed
    ? 'Соединение с участником потеряно. Попробуйте перезайти в комнату.'
    : 'Соединение нестабильно, восстанавливаем...';

  return (
    <div
      role="status"
      className={`flex items-center justify-center gap-2 px-4 py-2 text-sm text-white ${
        isFailed ? 'bg-red-600/90' : 'bg-amber-600/90'
      }`}
    >
      <span aria-hidden="true">{isFailed ? '⚠️' : '🔄'}</span>
      {message}
    </div>
  );
}

export default ConnectionStatusBanner;
