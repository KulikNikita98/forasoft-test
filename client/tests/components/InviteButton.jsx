import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InviteButton from '../../src/components/InviteButton.jsx';

describe('InviteButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders copy label initially', () => {
    render(<InviteButton />);
    expect(screen.getByRole('button', { name: 'Копировать ссылку' })).toBeInTheDocument();
  });

  it('copies current URL to clipboard and shows confirmation', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    });

    render(<InviteButton />);
    await user.click(screen.getByRole('button', { name: 'Копировать ссылку' }));

    expect(writeText).toHaveBeenCalledWith(window.location.href);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Ссылка скопирована/ })).toBeInTheDocument()
    );
  });
});
