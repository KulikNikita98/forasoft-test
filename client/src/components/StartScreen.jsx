import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { validateUserName } from '../utils/validation.js';
import { createRoom } from '../services/api.js';
import config from '../config/index.js';

/**
 * StartScreen — стартовый экран: ввод имени и создание комнаты.
 */
function StartScreen() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateRoom = async () => {
    const check = validateUserName(userName);
    if (!check.valid) {
      setError(check.error);
      return;
    }

    setError('');
    setIsCreating(true);
    try {
      const { roomId } = await createRoom(check.value);
      // Передаём имя в state, чтобы RoomScreen не запрашивал его повторно
      navigate(`/room/${roomId}`, { state: { userName: check.value } });
    } catch (err) {
      setError(err.message || 'Не удалось создать комнату');
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCreateRoom();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-800 p-8 shadow-xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">
          {config.app.title}
        </h1>
        <p className="mb-6 text-center text-gray-400">
          Введите имя, чтобы создать комнату
        </p>

        <label htmlFor="userName" className="mb-2 block text-sm font-medium text-gray-300">
          Ваше имя
        </label>
        <input
          id="userName"
          type="text"
          value={userName}
          maxLength={config.app.maxUsernameLength}
          onChange={(e) => setUserName(e.target.value)}
          onKeyDown={handleKeyDown}
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
          onClick={handleCreateRoom}
          disabled={isCreating}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isCreating ? 'Создание...' : 'Создать комнату'}
        </button>
      </div>
    </div>
  );
}

export default StartScreen;
