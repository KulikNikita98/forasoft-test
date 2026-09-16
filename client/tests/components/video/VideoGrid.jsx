import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import VideoGrid from '../../../src/components/video/VideoGrid.jsx';

describe('VideoGrid', () => {
  beforeEach(() => {
    // Mock HTMLVideoElement
    HTMLVideoElement.prototype.play = vi.fn(() => Promise.resolve());
  });

  it('отображает только локальный tile когда нет участников', () => {
    render(
      <VideoGrid
        participants={[]}
        localStream={null}
        localUserName="Local User"
        isLocalMuted={false}
        isLocalVideoOff={false}
      />
    );

    const names = screen.getAllByText('Local User');
    expect(names.length).toBeGreaterThan(0);
    expect(screen.getByText('(вы)')).toBeInTheDocument();
  });

  it('применяет grid-cols-1 для одного участника', () => {
    const { container } = render(
      <VideoGrid
        participants={[]}
        localStream={null}
        localUserName="Solo"
        isLocalMuted={false}
        isLocalVideoOff={false}
      />
    );

    const grid = container.firstChild;
    expect(grid?.className).toContain('grid-cols-1');
  });

  it('применяет grid-cols-1 sm:grid-cols-2 для двух участников', () => {
    const { container } = render(
      <VideoGrid
        participants={[
          { socketId: 'peer-1', userName: 'Peer 1', stream: null, isMuted: false, isVideoOff: false }
        ]}
        localStream={null}
        localUserName="Local"
        isLocalMuted={false}
        isLocalVideoOff={false}
      />
    );

    const grid = container.firstChild;
    expect(grid?.className).toContain('grid-cols-1');
    expect(grid?.className).toContain('sm:grid-cols-2');
  });

  it('применяет grid-cols-2 для трех участников', () => {
    const { container } = render(
      <VideoGrid
        participants={[
          { socketId: 'peer-1', userName: 'Peer 1', stream: null },
          { socketId: 'peer-2', userName: 'Peer 2', stream: null }
        ]}
        localStream={null}
        localUserName="Local"
        isLocalMuted={false}
        isLocalVideoOff={false}
      />
    );

    const grid = container.firstChild;
    expect(grid?.className).toContain('grid-cols-2');
    expect(grid?.className).not.toContain('md:grid-cols-2');
  });

  it('применяет grid-cols-2 для четырех участников', () => {
    const { container } = render(
      <VideoGrid
        participants={[
          { socketId: 'peer-1', userName: 'Peer 1', stream: null },
          { socketId: 'peer-2', userName: 'Peer 2', stream: null },
          { socketId: 'peer-3', userName: 'Peer 3', stream: null }
        ]}
        localStream={null}
        localUserName="Local"
        isLocalMuted={false}
        isLocalVideoOff={false}
      />
    );

    const grid = container.firstChild;
    expect(grid?.className).toContain('grid-cols-2');
  });

  it('отображает локальный tile и tiles участников', () => {
    render(
      <VideoGrid
        participants={[
          { socketId: 'peer-1', userName: 'Alice', stream: null, isMuted: false, isVideoOff: false },
          { socketId: 'peer-2', userName: 'Bob', stream: null, isMuted: true, isVideoOff: false }
        ]}
        localStream={null}
        localUserName="Me"
        isLocalMuted={false}
        isLocalVideoOff={false}
      />
    );

    expect(screen.getAllByText(/Me/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bob/).length).toBeGreaterThan(0);
  });

  it('передает isLocal=true только локальному tile', () => {
    render(
      <VideoGrid
        participants={[
          { socketId: 'peer-1', userName: 'Remote', stream: null, isMuted: false, isVideoOff: false }
        ]}
        localStream={null}
        localUserName="Local"
        isLocalMuted={false}
        isLocalVideoOff={false}
      />
    );

    // Локальный имеет "(вы)"
    expect(screen.getByText('(вы)')).toBeInTheDocument();
    // Удаленный не имеет
    expect(screen.getAllByText(/Local|Remote/).length).toBeGreaterThan(0);
  });

  it('передает индикаторы состояния в VideoTile', () => {
    render(
      <VideoGrid
        participants={[
          { socketId: 'peer-1', userName: 'Muted User', stream: null, isMuted: true, isVideoOff: false }
        ]}
        localStream={null}
        localUserName="Local Muted"
        isLocalMuted={true}
        isLocalVideoOff={false}
      />
    );

    const mutedIcons = screen.getAllByTitle('Микрофон выключен');
    expect(mutedIcons.length).toBe(2); // Локальный и удаленный оба замьючены
  });
});