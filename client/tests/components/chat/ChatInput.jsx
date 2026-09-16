import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInput from '../../../src/components/chat/ChatInput.jsx';

describe('ChatInput', () => {
  it('отправляет сообщение при клике на кнопку', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    await user.type(screen.getByLabelText('Поле ввода сообщения'), 'Привет');
    await user.click(screen.getByLabelText('Отправить сообщение'));

    expect(onSend).toHaveBeenCalledWith('Привет');
  });

  it('отправляет сообщение по нажатию Enter', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    await user.type(screen.getByLabelText('Поле ввода сообщения'), 'Тест{Enter}');

    expect(onSend).toHaveBeenCalledWith('Тест');
  });

  it('очищает поле после отправки', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    const input = screen.getByLabelText('Поле ввода сообщения');
    await user.type(input, 'Сообщение{Enter}');

    expect(input.value).toBe('');
  });

  it('блокирует отправку пустого сообщения', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    await user.click(screen.getByLabelText('Отправить сообщение'));

    expect(onSend).not.toHaveBeenCalled();
  });

  it('блокирует отправку сообщения из одних пробелов', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    await user.type(screen.getByLabelText('Поле ввода сообщения'), '   {Enter}');

    expect(onSend).not.toHaveBeenCalled();
  });

  it('обрезает пробелы по краям при отправке', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    await user.type(screen.getByLabelText('Поле ввода сообщения'), '  Привет  {Enter}');

    expect(onSend).toHaveBeenCalledWith('Привет');
  });

  it('кнопка отправки disabled при пустом поле', () => {
    render(<ChatInput onSend={vi.fn()} />);

    expect(screen.getByLabelText('Отправить сообщение')).toBeDisabled();
  });
});
