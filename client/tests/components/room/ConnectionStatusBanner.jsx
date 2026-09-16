import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConnectionStatusBanner from '../../../src/components/room/ConnectionStatusBanner.jsx';

describe('ConnectionStatusBanner', () => {
  it('не рендерится без состояния', () => {
    const { container } = render(<ConnectionStatusBanner state={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('показывает сообщение о нестабильном соединении при disconnected', () => {
    render(<ConnectionStatusBanner state="disconnected" />);
    expect(screen.getByRole('status')).toHaveTextContent(/восстанавливаем/i);
  });

  it('показывает сообщение о потере соединения при failed', () => {
    render(<ConnectionStatusBanner state="failed" />);
    expect(screen.getByRole('status')).toHaveTextContent(/соединение с участником потеряно/i);
  });

  it('предлагает перезайти при failed', () => {
    render(<ConnectionStatusBanner state="failed" />);
    expect(screen.getByRole('status')).toHaveTextContent(/перезайти/i);
  });
});
