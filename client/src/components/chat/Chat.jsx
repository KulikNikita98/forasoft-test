import { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage.jsx';
import ChatInput from './ChatInput.jsx';

/**
 * Chat — панель текстового чата с историей, отправкой и автопрокруткой.
 *
 * @param {object} props
 * @param {Array} props.messages — сообщения (user и system)
 * @param {(text: string) => void} props.onSend
 * @param {string} props.currentSocketId — socketId текущего пользователя (для пометки "Вы")
 */
function Chat({ messages = [], onSend, currentSocketId }) {
  const bottomRef = useRef(null);

  // Автопрокрутка к последнему сообщению (F-14)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
        Чат
      </h2>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-600">Сообщений пока нет</p>
        ) : (
          messages.map((msg, index) => (
            <ChatMessage
              key={msg.id ?? `${msg.timestamp}-${index}`}
              type={msg.type || 'user'}
              fromName={msg.fromName}
              message={msg.message}
              text={msg.text}
              timestamp={msg.timestamp}
              isOwn={msg.from === currentSocketId}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3">
        <ChatInput onSend={onSend} />
      </div>
    </div>
  );
}

export default Chat;
