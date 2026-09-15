import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Input from '../../../src/components/common/Input.jsx';

describe('Input', () => {
  it('рендерит с label', () => {
    render(<Input id="test" label="Имя" value="" onChange={() => {}} />);
    expect(screen.getByLabelText(/имя/i)).toBeInTheDocument();
  });

  it('отображает placeholder', () => {
    render(<Input id="test" placeholder="Введите имя" value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText(/введите имя/i)).toBeInTheDocument();
  });

  it('вызывает onChange при вводе', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(<Input id="test" value="" onChange={handleChange} />);
    const input = screen.getByRole('textbox');

    await user.type(input, 'Алекс');
    expect(handleChange).toHaveBeenCalled();
  });

  it('отображает ошибку', () => {
    render(<Input id="test" value="" error="Обязательное поле" onChange={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/обязательное поле/i);
  });

  it('поддерживает maxLength', () => {
    render(<Input id="test" maxLength={30} value="" onChange={() => {}} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('maxLength', '30');
  });

  it('вызывает onKeyDown при нажатии Enter', async () => {
    const handleKeyDown = vi.fn();
    const user = userEvent.setup();

    render(<Input id="test" value="" onChange={() => {}} onKeyDown={handleKeyDown} />);
    const input = screen.getByRole('textbox');

    await user.type(input, '{Enter}');
    expect(handleKeyDown).toHaveBeenCalled();
  });

  it('поддерживает autoFocus', () => {
    render(<Input id="test" autoFocus value="" onChange={() => {}} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveFocus();
  });
});
