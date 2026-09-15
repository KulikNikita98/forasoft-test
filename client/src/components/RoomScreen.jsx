import { useParams } from 'react-router-dom';

/**
 * RoomScreen — экран комнаты (видеосетка, чат, управление).
 * Полная реализация — задача 11.
 */
function RoomScreen() {
  const { roomId } = useParams();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
      <p className="text-lg">Комната: {roomId}</p>
    </div>
  );
}

export default RoomScreen;
