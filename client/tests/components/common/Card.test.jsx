import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Card from '../../../src/components/common/Card.jsx';

describe('Card', () => {
  it('рендерит children', () => {
    render(
      <Card>
        <h1>Заголовок</h1>
        <p>Контент</p>
      </Card>
    );

    expect(screen.getByRole('heading', { name: /заголовок/i })).toBeInTheDocument();
    expect(screen.getByText(/контент/i)).toBeInTheDocument();
  });

  it('применяет базовые стили', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild;

    expect(card).toHaveClass('rounded-2xl');
    expect(card).toHaveClass('bg-gray-800');
    expect(card).toHaveClass('p-8');
    expect(card).toHaveClass('shadow-xl');
  });

  it('применяет дополнительный className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    const card = container.firstChild;

    expect(card).toHaveClass('custom-class');
    expect(card).toHaveClass('rounded-2xl'); // базовый класс тоже присутствует
  });
});
