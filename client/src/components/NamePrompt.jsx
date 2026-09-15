import { useState } from 'react';
import { validateUserName } from '../utils/validation.js';
import config from '../config/index.js';

/**
 * NamePrompt — запрос имени при прямом входе по ссылке-приглашению
 * (когда /room/:roomId открыт без userName в navigation state).
 *
 * @param {object} props
 * @param {(name: string) => void} props.onSubmit
 */
function NamePrompt({ onSubmit }) {
  const [userName, setUserName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    const check = validateUserName(userName);
    if (!check.valid) {
      setError(check.error);
      return;
    }
    setError('');
    onSubmit(check.value);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-800 p-8 shadow-xl">
        <h1 className="mb-6 text-center text-2xl font-bold text-white">
          Вход в комнату
        </h1>
        <label htmlFor="userName" className="mb-2 block text-sm font-medium text-gray-300">
          Ваше имя
        </label>
        <input
          id="userName"
          type="text"
          value={userName}
          maxLength={config.app.maxUsernameLength}
          onChange={(e) => setUserName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Например, Алекс"
          className="mb-1 w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
          autoFocus
        />
        {error && (
          <p role="alert" className="mb-2 text-sm text-red-400">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          Войти
        </button>
      </div>
    </div>
  );
}

export default NamePrompt;
