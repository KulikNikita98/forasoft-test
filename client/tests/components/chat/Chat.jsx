import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Chat from '../../../src/components/chat/Chat.jsx';

describe('Chat', () => {
  beforeEach(() => {
    // scrollIntoView не реализован в jsdom
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('показывает заглушку когда нет сообщений', () => {
    render(<Chat messages={[]} onSend={vi.fn()} currentSocketId="me" />);

    expect(screen.getByText('Сообщений пока нет')).toBeInTheDocument();
  });

  it('отображает список сообщений', () => {
    const messages = [
      { from: 'peer-1', fromName: 'Алекс', message: 'Привет', timestamp: Date.now(), type: 'user' },
      { from: 'peer-2', fromName: 'Мария', message: 'Здравствуйте', timestamp: Date.now(), type: 'user' }
    ];

    render(<Chat messages={messages} onSend={vi.fn()} currentSocketId="me" />);

    expect(screen.getByText('Привет')).toBeInTheDocument();
    expect(screen.getByText('Здравствуйте')).toBeInTheDocument();
    expect(screen.getByText('Алекс')).toBeInTheDocument();
    expect(screen.getByText('Мария')).toBeInTheDocument();
  });

  it('помечает собственные сообщения как "Вы"', () => {
    const messages = [
      { from: 'me', fromName: 'Я', message: 'Моё', timestamp: Date.now(), type: 'user' }
    ];

    render(<Chat messages={messages} onSend={vi.fn()} currentSocketId="me" />);

    expect(screen.getByText('Вы')).toBeInTheDocument();
  });

  it('отображает системные сообщения', () => {
    const messages = [
      { id: 1, type: 'system', text: 'Пётр покинул комнату', timestamp: Date.now() }
    ];

    render(<Chat messages={messages} onSend={vi.fn()} currentSocketId="me" />);

    expect(screen.getByText('Пётр покинул комнату')).toBeInTheDocument();
  });

  it('прокручивает к последнему сообщению', () => {
    const messages = [
      { from: 'peer-1', fromName: 'Алекс', message: 'Первое', timestamp: Date.now(), type: 'user' }
    ];

    render(<Chat messages={messages} onSend={vi.fn()} currentSocketId="me" />);

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('рендерит поле ввода', () => {
    render(<Chat messages={[]} onSend={vi.fn()} currentSocketId="me" />);

    expect(screen.getByLabelText('Поле ввода сообщения')).toBeInTheDocument();
  });
});
