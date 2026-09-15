import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ParticipantList from '../../../src/components/participant/ParticipantList.jsx';

describe('ParticipantList', () => {
  const mockParticipants = [
    { socketId: '1', userName: 'Алекс' },
    { socketId: '2', userName: 'Мария' },
    { socketId: '3', userName: 'Иван' }
  ];

  it('отображает заголовок со счетчиком участников', () => {
    render(<ParticipantList participants={mockParticipants} currentUserName="Алекс" />);
    expect(screen.getByText(/участники \(3\)/i)).toBeInTheDocument();
  });

  it('рендерит всех участников', () => {
    render(<ParticipantList participants={mockParticipants} currentUserName="Алекс" />);

    expect(screen.getByText('Алекс')).toBeInTheDocument();
    expect(screen.getByText('Мария')).toBeInTheDocument();
    expect(screen.getByText('Иван')).toBeInTheDocument();
  });

  it('помечает текущего пользователя', () => {
    render(<ParticipantList participants={mockParticipants} currentUserName="Алекс" />);
    expect(screen.getByText('(вы)')).toBeInTheDocument();
  });

  it('отображает пустой список', () => {
    render(<ParticipantList participants={[]} currentUserName="Алекс" />);
    expect(screen.getByText(/участники \(0\)/i)).toBeInTheDocument();
  });

  it('работает с дефолтными пропсами', () => {
    render(<ParticipantList />);
    expect(screen.getByText(/участники \(0\)/i)).toBeInTheDocument();
  });

  it('передает состояние медиа участникам', () => {
    const participantsWithMedia = [
      { socketId: '1', userName: 'Алекс', isMuted: true, isVideoOff: false }
    ];

    render(<ParticipantList participants={participantsWithMedia} currentUserName="Алекс" />);
    expect(screen.getByTitle(/микрофон выключен/i)).toBeInTheDocument();
  });
});
