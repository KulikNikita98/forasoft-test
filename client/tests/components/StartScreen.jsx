import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Мокаем API и навигацию
vi.mock('../../src/services/api.js', () => ({
  createRoom: vi.fn()
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}));

import { createRoom } from '../../src/services/api.js';
import StartScreen from '../../src/components/StartScreen.jsx';

describe('StartScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders name input and create button', () => {
    render(<StartScreen />);
    expect(screen.getByLabelText('Ваше имя')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Создать комнату/ })).toBeInTheDocument();
  });

  it('shows validation error for empty name', async () => {
    const user = userEvent.setup();
    render(<StartScreen />);
    await user.click(screen.getByRole('button', { name: /Создать комнату/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Введите имя');
    expect(createRoom).not.toHaveBeenCalled();
  });

  it('shows validation error for special characters', async () => {
    const user = userEvent.setup();
    render(<StartScreen />);
    await user.type(screen.getByLabelText('Ваше имя'), '<script>');
    await user.click(screen.getByRole('button', { name: /Создать комнату/ }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(createRoom).not.toHaveBeenCalled();
  });

  it('creates room and navigates on valid name', async () => {
    const user = userEvent.setup();
    createRoom.mockResolvedValue({ roomId: 'uuid-123', createdAt: 1 });
    render(<StartScreen />);

    await user.type(screen.getByLabelText('Ваше имя'), 'Алекс');
    await user.click(screen.getByRole('button', { name: /Создать комнату/ }));

    await waitFor(() => {
      expect(createRoom).toHaveBeenCalledWith('Алекс');
      expect(mockNavigate).toHaveBeenCalledWith('/room/uuid-123', {
        state: { userName: 'Алекс' }
      });
    });
  });

  it('shows error when room creation fails', async () => {
    const user = userEvent.setup();
    createRoom.mockRejectedValue(new Error('Сервер недоступен'));
    render(<StartScreen />);

    await user.type(screen.getByLabelText('Ваше имя'), 'Алекс');
    await user.click(screen.getByRole('button', { name: /Создать комнату/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Сервер недоступен');
  });
});
