import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ParticipantList from '../../src/components/ParticipantList.jsx';

describe('ParticipantList', () => {
  it('shows participant count', () => {
    render(
      <ParticipantList
        participants={[
          { socketId: 's1', userName: 'Alice' },
          { socketId: 's2', userName: 'Bob' }
        ]}
      />
    );
    expect(screen.getByText('Участники (2)')).toBeInTheDocument();
  });

  it('renders all participant names', () => {
    render(
      <ParticipantList
        participants={[
          { socketId: 's1', userName: 'Alice' },
          { socketId: 's2', userName: 'Bob' }
        ]}
      />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('marks current user with "(вы)"', () => {
    render(
      <ParticipantList
        participants={[{ socketId: 's1', userName: 'Alice' }]}
        currentUserName="Alice"
      />
    );
    expect(screen.getByText('(вы)')).toBeInTheDocument();
  });

  it('handles empty list', () => {
    render(<ParticipantList participants={[]} />);
    expect(screen.getByText('Участники (0)')).toBeInTheDocument();
  });
});
