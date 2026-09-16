import { useState } from 'react';
import config from '../../config/index.js';

/**
 * ChatInput — поле ввода и отправки сообщения.
 * Блокирует отправку пустых/пробельных сообщений (п.24).
 *
 * @param {object} props
 * @param {(text: string) => void} props.onSend
 */
function ChatInput({ onSend }) {
  const [text, setText] = useState('');

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return; // блокировка пустых сообщений
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = text.trim().length === 0;

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={text}
        maxLength={config.app.maxMessageLength}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Сообщение..."
        aria-label="Поле ввода сообщения"
        className="flex-1 rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={isEmpty}
        aria-label="Отправить сообщение"
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        →
      </button>
    </div>
  );
}

export default ChatInput;
