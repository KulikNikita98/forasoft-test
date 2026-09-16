/**
 * Форматирует timestamp в HH:MM по локальному времени клиента.
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
 *
 * @param {object} props
 * @param {'user' | 'system'} props.type
 * @param {string} [props.fromName]
 * @param {string} [props.message]
 * @param {string} [props.text]
 * @param {number} props.timestamp
 * @param {boolean} [props.isOwn]
 */
function ChatMessage({ type, fromName, message, text, timestamp, isOwn = false }) {
  if (type === 'system') {
    return (
      <div className="py-1 text-center text-xs text-gray-500">
        {text}
      </div>
    );
  }

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
