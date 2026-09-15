import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Participant from '../../../src/components/participant/Participant.jsx';

describe('Participant', () => {
  it('отображает имя участника', () => {
    render(<Participant userName="Алекс" />);
    expect(screen.getByText('Алекс')).toBeInTheDocument();
  });

  it('показывает пометку "(вы)" для текущего пользователя', () => {
    render(<Participant userName="Алекс" isCurrentUser={true} />);
    expect(screen.getByText('(вы)')).toBeInTheDocument();
  });

  it('не показывает пометку "(вы)" для других участников', () => {
    render(<Participant userName="Мария" isCurrentUser={false} />);
    expect(screen.queryByText('(вы)')).not.toBeInTheDocument();
  });

  it('отображает индикатор выключенного микрофона', () => {
    render(<Participant userName="Алекс" isMuted={true} />);
    expect(screen.getByTitle(/микрофон выключен/i)).toBeInTheDocument();
  });

  it('отображает индикатор выключенной камеры', () => {
    render(<Participant userName="Алекс" isVideoOff={true} />);
    expect(screen.getByTitle(/камера выключена/i)).toBeInTheDocument();
  });

  it('отображает оба индикатора одновременно', () => {
    render(<Participant userName="Алекс" isMuted={true} isVideoOff={true} />);
    expect(screen.getByTitle(/микрофон выключен/i)).toBeInTheDocument();
    expect(screen.getByTitle(/камера выключена/i)).toBeInTheDocument();
  });

  it('не отображает индикаторы при активных устройствах', () => {
    render(<Participant userName="Алекс" isMuted={false} isVideoOff={false} />);
    expect(screen.queryByTitle(/микрофон выключен/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/камера выключена/i)).not.toBeInTheDocument();
  });
});
