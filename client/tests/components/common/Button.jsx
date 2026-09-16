import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Button from '../../../src/components/common/Button.jsx';

describe('Button', () => {
  it('рендерит с текстом', () => {
    render(<Button>Нажми меня</Button>);
    expect(screen.getByRole('button', { name: /нажми меня/i })).toBeInTheDocument();
  });

  it('вызывает onClick при клике', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Кликни</Button>);
    await user.click(screen.getByRole('button'));

    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('применяет primary стиль по умолчанию', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-blue-600');
  });

  it('применяет secondary стиль', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-gray-700');
  });

  it('применяет danger стиль', () => {
    render(<Button variant="danger">Danger</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-red-600');
  });

  it('поддерживает disabled состояние', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    const button = screen.getByRole('button');

    expect(button).toBeDisabled();
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('применяет fullWidth класс', () => {
    render(<Button fullWidth>Full</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('w-full');
  });

  it('добавляет переданный className к базовым, не перезаписывая их', () => {
    render(<Button className="mt-4 custom-class">С классом</Button>);
    const button = screen.getByRole('button');

    // Внешний класс применён
    expect(button).toHaveClass('mt-4');
    expect(button).toHaveClass('custom-class');
    // Внутренние классы сохранены
    expect(button).toHaveClass('bg-blue-600');
    expect(button).toHaveClass('rounded-lg');
  });

  it('не оставляет двойных пробелов в className без внешнего класса', () => {
    render(<Button>Без класса</Button>);
    const button = screen.getByRole('button');
    expect(button.className).not.toMatch(/\s{2,}/);
  });
});
