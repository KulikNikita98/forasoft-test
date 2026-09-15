import { useNavigate } from 'react-router-dom';
import { Button } from '../common/index.js';

/**
 * RoomError — экран ошибки входа в комнату (заполнена / сервер недоступен).
 *
 * @param {object} props
 * @param {{ type: string, message?: string }} props.error
 */
function RoomError({ error }) {
  const navigate = useNavigate();

  const isRoomFull = error?.type === 'room-full';
  const title = isRoomFull ? 'Комната заполнена' : 'Ошибка соединения';
  const description = isRoomFull
    ? 'В комнате уже максимум участников (4). Попробуйте войти позже.'
    : error?.message || 'Не удалось подключиться к серверу.';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-900 px-4 text-center">
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      <p className="max-w-md text-gray-300">{description}</p>
      <div className="flex gap-3">
        <Button variant="primary" onClick={() => window.location.reload()}>
          Повторить
        </Button>
        <Button variant="secondary" onClick={() => navigate('/')}>
          На главную
        </Button>
      </div>
    </div>
  );
}

export default RoomError;
