import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Мокаем useSocket — управляем состоянием подключения из тестов
vi.mock('../../src/hooks/useSocket.js', () => ({
  useSocket: vi.fn()
}));

// Мокаем router-хуки
let mockParams = { roomId: 'room-1' };
let mockLocationState = { userName: 'Alice' };
vi.mock('react-router-dom', () => ({
  useParams: () => mockParams,
  useLocation: () => ({ state: mockLocationState }),
  useNavigate: () => vi.fn()
}));

import { useSocket } from '../../src/hooks/useSocket.js';
import RoomScreen from '../../src/components/RoomScreen.jsx';

function mockSocket() {
  return { on: vi.fn(), off: vi.fn() };
}

describe('RoomScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockParams = { roomId: 'room-1' };
    mockLocationState = { userName: 'Alice' };
  });

  it('shows NamePrompt when no userName provided', () => {
    mockLocationState = {}; // прямой вход по ссылке без имени
    useSocket.mockReturnValue({ socket: null, status: 'connecting', error: null, roomState: null });
    render(<RoomScreen />);
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
  });

  it('shows connecting state', () => {
    useSocket.mockReturnValue({
      socket: mockSocket(),
      status: 'connecting',
      error: null,
      roomState: null
    });
    render(<RoomScreen />);
    expect(screen.getByText('Подключение...')).toBeInTheDocument();
  });

  it('shows RoomError on room-full', () => {
    useSocket.mockReturnValue({
      socket: null,
      status: 'error',
      error: { type: 'room-full' },
      roomState: null
    });
    render(<RoomScreen />);
    expect(screen.getByText('Комната заполнена')).toBeInTheDocument();
  });

  it('renders participants from roomState', () => {
    useSocket.mockReturnValue({
      socket: mockSocket(),
      status: 'connected',
      error: null,
      roomState: {
        participants: [
          { socketId: 's1', userName: 'Alice' },
          { socketId: 's2', userName: 'Bob' }
        ],
        chatHistory: []
      }
    });
    render(<RoomScreen />);
    expect(screen.getByText('Участники (2)')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders invite button', () => {
    useSocket.mockReturnValue({
      socket: mockSocket(),
      status: 'connected',
      error: null,
      roomState: { participants: [], chatHistory: [] }
    });
    render(<RoomScreen />);
    expect(screen.getByRole('button', { name: 'Копировать ссылку' })).toBeInTheDocument();
  });
});
