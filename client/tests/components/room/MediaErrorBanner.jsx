import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MediaErrorBanner from '../../../src/components/room/MediaErrorBanner.jsx';

describe('MediaErrorBanner', () => {
  it('отображает сообщение об ошибке', () => {
    render(<MediaErrorBanner message="Доступ к камере/микрофону отклонен" />);

    expect(screen.getByRole('alert')).toHaveTextContent('Доступ к камере/микрофону отклонен');
  });

  it('поясняет, что пользователь остаётся в комнате', () => {
    render(<MediaErrorBanner message="Камера не найдена" />);

    expect(screen.getByRole('alert')).toHaveTextContent(/вы в комнате с выключенными устройствами/i);
  });

  it('не рендерится без сообщения', () => {
    const { container } = render(<MediaErrorBanner message="" />);

    expect(container.firstChild).toBeNull();
  });

  it('вызывает onDismiss при клике на закрытие', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();

    render(<MediaErrorBanner message="Ошибка" onDismiss={onDismiss} />);

    await user.click(screen.getByLabelText('Закрыть уведомление'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('не показывает кнопку закрытия без onDismiss', () => {
    render(<MediaErrorBanner message="Ошибка" />);

    expect(screen.queryByLabelText('Закрыть уведомление')).not.toBeInTheDocument();
  });
});
