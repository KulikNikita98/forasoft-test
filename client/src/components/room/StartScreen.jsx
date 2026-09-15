import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { validateUserName } from '../../utils/validation.js';
import { createRoom } from '../../services/api.js';
import config from '../../config/index.js';
import { Card, Input, Button } from '../common/index.js';

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
      <Card className="w-full max-w-md">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">
          {config.app.title}
        </h1>
        <p className="mb-6 text-center text-gray-400">
          Введите имя, чтобы создать комнату
        </p>

        <Input
          id="userName"
          label="Ваше имя"
          value={userName}
          maxLength={config.app.maxUsernameLength}
          onChange={(e) => setUserName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Например, Алекс"
          error={error}
          autoFocus
        />

        <Button
          variant="primary"
          fullWidth
          onClick={handleCreateRoom}
          disabled={isCreating}
          className="mt-4"
        >
          {isCreating ? 'Создание...' : 'Создать комнату'}
        </Button>
      </Card>
    </div>
  );
}

export default StartScreen;
