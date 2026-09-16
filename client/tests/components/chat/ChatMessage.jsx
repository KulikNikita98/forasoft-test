import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatMessage from '../../../src/components/chat/ChatMessage.jsx';

describe('ChatMessage', () => {
  it('отображает пользовательское сообщение с именем и текстом', () => {
    render(
      <ChatMessage
        type="user"
        fromName="Алекс"
        message="Привет всем!"
        timestamp={Date.now()}
      />
    );

    expect(screen.getByText('Алекс')).toBeInTheDocument();
    expect(screen.getByText('Привет всем!')).toBeInTheDocument();
  });

  it('форматирует время в HH:MM', () => {
    // 14:05 локального времени
    const date = new Date();
    date.setHours(14, 5, 0, 0);

    render(
      <ChatMessage
        type="user"
        fromName="Алекс"
        message="Тест"
        timestamp={date.getTime()}
      />
    );

    expect(screen.getByText('14:05')).toBeInTheDocument();
  });

  it('показывает "Вы" для собственного сообщения', () => {
    render(
      <ChatMessage
        type="user"
        fromName="Алекс"
        message="Моё сообщение"
        timestamp={Date.now()}
        isOwn={true}
      />
    );

    expect(screen.getByText('Вы')).toBeInTheDocument();
    expect(screen.queryByText('Алекс')).not.toBeInTheDocument();
  });

  it('отображает системное сообщение', () => {
    render(
      <ChatMessage
        type="system"
        text="Мария присоединилась к комнате"
        timestamp={Date.now()}
      />
    );

    expect(screen.getByText('Мария присоединилась к комнате')).toBeInTheDocument();
  });

  it('экранирует HTML/JS в тексте (защита от XSS)', () => {
    const malicious = '<script>alert("xss")</script>';

    render(
      <ChatMessage
        type="user"
        fromName="Хакер"
        message={malicious}
        timestamp={Date.now()}
      />
    );

    // React рендерит текст как строку, а не как HTML
    expect(screen.getByText(malicious)).toBeInTheDocument();
    // script-тег не должен попасть в DOM как элемент
    expect(document.querySelector('script')).toBeNull();
  });
});
