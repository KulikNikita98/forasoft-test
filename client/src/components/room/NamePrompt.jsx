import { useState } from 'react';
import { validateUserName } from '../../utils/validation.js';
import config from '../../config/index.js';
import { Card, Input, Button } from '../common/index.js';

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
      <Card className="w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-white">
          Вход в комнату
        </h1>
        <Input
          id="userName"
          label="Ваше имя"
          value={userName}
          maxLength={config.app.maxUsernameLength}
          onChange={(e) => setUserName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Например, Алекс"
          error={error}
          autoFocus
        />
        <Button
          variant="primary"
          fullWidth
          onClick={handleSubmit}
          className="mt-4"
        >
          Войти
        </Button>
      </Card>
    </div>
  );
}

export default NamePrompt;
