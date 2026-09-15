import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NamePrompt from '../../src/components/NamePrompt.jsx';

describe('NamePrompt', () => {
  it('renders name input and submit button', () => {
    render(<NamePrompt onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Ваше имя')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Войти' })).toBeInTheDocument();
  });

  it('shows validation error for empty name', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<NamePrompt onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with trimmed valid name', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<NamePrompt onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('Ваше имя'), '  Alice  ');
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(onSubmit).toHaveBeenCalledWith('Alice');
  });

  it('does not call onSubmit for invalid name', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<NamePrompt onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('Ваше имя'), '<script>');
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
