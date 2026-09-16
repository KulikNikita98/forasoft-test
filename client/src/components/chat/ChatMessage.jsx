/**
 * Форматирует timestamp в HH:MM по локальному времени клиента (F-13).
 * @param {number} timestamp
 * @returns {string}
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * ChatMessage — одно сообщение в чате (пользовательское или системное).
 * Текст рендерится через React → авто-экранирование XSS (NFR-SEC, п.39).
 *
 * @param {object} props
 * @param {'user' | 'system'} props.type
 * @param {string} [props.fromName] — имя отправителя (для user)
 * @param {string} [props.message] — текст (для user)
 * @param {string} [props.text] — текст (для system)
 * @param {number} props.timestamp
 * @param {boolean} [props.isOwn] — сообщение текущего пользователя
 */
function ChatMessage({ type, fromName, message, text, timestamp, isOwn = false }) {
  // Системное сообщение: по центру, приглушённое
  if (type === 'system') {
    return (
      <div className="py-1 text-center text-xs text-gray-500">
        {text}
      </div>
    );
  }

  // Пользовательское сообщение
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline gap-2">
        <span className={`text-xs font-semibold ${isOwn ? 'text-blue-400' : 'text-gray-300'}`}>
          {isOwn ? 'Вы' : fromName}
        </span>
        <span className="text-xs text-gray-600">{formatTime(timestamp)}</span>
      </div>
      <p className="break-words text-sm text-white">{message}</p>
    </div>
  );
}

export default ChatMessage;
