import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AudioUnlockOverlay from '../../../src/components/room/AudioUnlockOverlay.jsx';

describe('AudioUnlockOverlay', () => {
  it('отображает подсказку и кнопку', () => {
    render(<AudioUnlockOverlay onUnlock={vi.fn()} />);

    expect(screen.getByText(/включить звук участников/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /включить звук/i })).toBeInTheDocument();
  });

  it('вызывает onUnlock при клике', async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();

    render(<AudioUnlockOverlay onUnlock={onUnlock} />);

    await user.click(screen.getByRole('button', { name: /включить звук/i }));
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });
});
