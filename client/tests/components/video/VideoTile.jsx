import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import VideoTile from '../../../src/components/video/VideoTile.jsx';

describe('VideoTile', () => {
  let mockStream;

  beforeEach(() => {
    mockStream = {
      getTracks: vi.fn(() => [])
    };

    // Mock HTMLVideoElement
    HTMLVideoElement.prototype.play = vi.fn(() => Promise.resolve());
  });

  it('отображает video элемент когда есть stream и не isVideoOff', () => {
    render(
      <VideoTile
        stream={mockStream}
        userName="Test User"
        isMuted={false}
        isVideoOff={false}
        isLocal={false}
      />
    );

    const video = document.querySelector('video');
    expect(video).toBeTruthy();
  });

  it('показывает заглушку когда нет stream', () => {
    render(
      <VideoTile
        stream={null}
        userName="Test User"
        isMuted={false}
        isVideoOff={false}
        isLocal={false}
      />
    );

    const names = screen.getAllByText('Test User');
    expect(names.length).toBeGreaterThan(0);
    expect(screen.getByText('👤')).toBeInTheDocument();
    expect(document.querySelector('video')).toBeNull();
  });

  it('показывает заглушку когда isVideoOff=true', () => {
    render(
      <VideoTile
        stream={mockStream}
        userName="John Doe"
        isMuted={false}
        isVideoOff={true}
        isLocal={false}
      />
    );

    const names = screen.getAllByText('John Doe');
    expect(names.length).toBeGreaterThan(0);
    expect(screen.getByText('👤')).toBeInTheDocument();
  });

  it('отображает имя пользователя в overlay', () => {
    render(
      <VideoTile
        stream={mockStream}
        userName="Alice"
        isMuted={false}
        isVideoOff={false}
        isLocal={false}
      />
    );

    // Имя в overlay (внизу видео)
    const overlayName = screen.getAllByText('Alice')[0];
    expect(overlayName).toBeInTheDocument();
  });

  it('показывает "(вы)" для локального участника', () => {
    render(
      <VideoTile
        stream={mockStream}
        userName="Me"
        isMuted={false}
        isVideoOff={false}
        isLocal={true}
      />
    );

    expect(screen.getByText('(вы)')).toBeInTheDocument();
  });

  it('показывает индикатор выключенного микрофона', () => {
    render(
      <VideoTile
        stream={mockStream}
        userName="Bob"
        isMuted={true}
        isVideoOff={false}
        isLocal={false}
      />
    );

    const mutedIcon = screen.getByTitle('Микрофон выключен');
    expect(mutedIcon).toBeInTheDocument();
    expect(mutedIcon.textContent).toBe('🔇');
  });

  it('не показывает индикатор микрофона когда не замьючен', () => {
    render(
      <VideoTile
        stream={mockStream}
        userName="Carol"
        isMuted={false}
        isVideoOff={false}
        isLocal={false}
      />
    );

    expect(screen.queryByTitle('Микрофон выключен')).toBeNull();
  });

  it('video элемент muted=true для локального участника', () => {
    render(
      <VideoTile
        stream={mockStream}
        userName="Local User"
        isMuted={false}
        isVideoOff={false}
        isLocal={true}
      />
    );

    const video = document.querySelector('video');
    expect(video?.muted).toBe(true);
  });

  it('video элемент muted=false для удаленного участника', () => {
    render(
      <VideoTile
        stream={mockStream}
        userName="Remote User"
        isMuted={false}
        isVideoOff={false}
        isLocal={false}
      />
    );

    const video = document.querySelector('video');
    expect(video?.muted).toBe(false);
  });
});
