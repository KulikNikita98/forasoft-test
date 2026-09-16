import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import VideoTile from '../../../src/components/video/VideoTile.jsx';

/** Трек с поддержкой событий mute/unmute/ended, как у настоящего MediaStreamTrack. */
function createTrack(kind = 'video', overrides = {}) {
  const track = new EventTarget();
  track.kind = kind;
  track.readyState = 'live';
  track.enabled = true;
  track.muted = false;
  return Object.assign(track, overrides);
}

/** MediaStream-подобный мок: события addtrack/removetrack + геттеры треков. */
function createStream(tracks = [createTrack('video'), createTrack('audio')]) {
  const stream = new EventTarget();
  stream.id = `stream-${Math.random()}`;
  stream.getTracks = () => tracks;
  stream.getVideoTracks = () => tracks.filter((t) => t.kind === 'video');
  stream.getAudioTracks = () => tracks.filter((t) => t.kind === 'audio');
  return stream;
}

/** Симулирует приход кадров: video сообщает, что воспроизведение пошло. */
function startPlayback() {
  fireEvent.playing(document.querySelector('video'));
}

describe('VideoTile', () => {
  beforeEach(() => {
    HTMLVideoElement.prototype.play = vi.fn(() => Promise.resolve());
  });

  it('держит video в DOM даже без потока — иначе srcObject терялся бы при каждом toggle', () => {
    render(<VideoTile stream={null} userName="Test User" />);

    expect(document.querySelector('video')).toBeTruthy();
  });

  it('показывает заглушку когда нет stream', () => {
    render(<VideoTile stream={null} userName="Test User" />);

    expect(screen.getByText('👤')).toBeInTheDocument();
    expect(screen.getAllByText('Test User').length).toBeGreaterThan(0);
  });

  it('привязывает stream к video элементу', () => {
    const stream = createStream();
    render(<VideoTile stream={stream} userName="Alice" />);

    expect(document.querySelector('video').srcObject).toBe(stream);
  });

  it('очищает srcObject когда поток пропал', () => {
    const stream = createStream();
    const { rerender } = render(<VideoTile stream={stream} userName="Alice" />);
    expect(document.querySelector('video').srcObject).toBe(stream);

    rerender(<VideoTile stream={null} userName="Alice" />);

    expect(document.querySelector('video').srcObject).toBeNull();
  });

  it('показывает видео когда есть живой трек и пошло воспроизведение', () => {
    render(<VideoTile stream={createStream()} userName="Alice" />);

    act(startPlayback);

    expect(screen.queryByText('👤')).toBeNull();
    expect(document.querySelector('video').className).toContain('opacity-100');
  });

  it('держит заглушку пока кадры не пошли, даже если трек уже есть', () => {
    render(<VideoTile stream={createStream()} userName="Alice" />);

    // 'playing' не сработал: у WebRTC-трека кадры приходят не сразу
    expect(screen.getByText('👤')).toBeInTheDocument();
    expect(document.querySelector('video').className).toContain('opacity-0');
  });

  it('показывает заглушку при isVideoOff, даже когда кадры идут', () => {
    // isVideoOff приходит из media-state: у получателя трек остаётся live,
    // поэтому флаг — единственный сигнал, что собеседник выключил камеру
    render(<VideoTile stream={createStream()} userName="John" isVideoOff />);

    act(startPlayback);

    expect(screen.getByText('👤')).toBeInTheDocument();
  });

  it('возвращает видео когда собеседник снова включил камеру', () => {
    const stream = createStream();
    const { rerender } = render(
      <VideoTile stream={stream} userName="John" isVideoOff />
    );
    act(startPlayback);
    expect(screen.getByText('👤')).toBeInTheDocument();

    rerender(<VideoTile stream={stream} userName="John" isVideoOff={false} />);

    expect(screen.queryByText('👤')).toBeNull();
  });

  it('перезапускает воспроизведение когда в трек пошли кадры (unmute)', () => {
    const videoTrack = createTrack('video', { muted: true });
    render(<VideoTile stream={createStream([videoTrack])} userName="Alice" />);
    HTMLVideoElement.prototype.play.mockClear();

    act(() => {
      videoTrack.dispatchEvent(new Event('unmute'));
    });

    expect(HTMLVideoElement.prototype.play).toHaveBeenCalled();
  });

  it('прячет видео если воспроизведение прервалось', () => {
    render(<VideoTile stream={createStream()} userName="Alice" />);
    act(startPlayback);
    expect(screen.queryByText('👤')).toBeNull();

    act(() => {
      fireEvent.pause(document.querySelector('video'));
    });

    expect(screen.getByText('👤')).toBeInTheDocument();
  });

  it('глушит локальное видео, чтобы не было эха', () => {
    render(<VideoTile stream={createStream()} userName="Me" isLocal />);

    expect(document.querySelector('video').muted).toBe(true);
  });

  it('глушит удалённое видео до жеста пользователя — иначе autoplay заблокирует показ', () => {
    render(<VideoTile stream={createStream()} userName="Remote" audioUnlocked={false} />);

    expect(document.querySelector('video').muted).toBe(true);
  });

  it('возвращает звук удалённому видео после жеста пользователя', () => {
    const stream = createStream();
    const { rerender } = render(
      <VideoTile stream={stream} userName="Remote" audioUnlocked={false} />
    );

    rerender(<VideoTile stream={stream} userName="Remote" audioUnlocked />);

    expect(document.querySelector('video').muted).toBe(false);
  });

  it('не включает звук локальной плитке даже после жеста', () => {
    render(<VideoTile stream={createStream()} userName="Me" isLocal audioUnlocked />);

    expect(document.querySelector('video').muted).toBe(true);
  });

  it('отображает имя пользователя в overlay', () => {
    render(<VideoTile stream={createStream()} userName="Alice" />);

    expect(screen.getAllByText('Alice')[0]).toBeInTheDocument();
  });

  it('показывает "(вы)" для локального участника', () => {
    render(<VideoTile stream={createStream()} userName="Me" isLocal />);

    expect(screen.getByText('(вы)')).toBeInTheDocument();
  });

  it('показывает индикатор выключенного микрофона', () => {
    render(<VideoTile stream={createStream()} userName="Bob" isMuted />);

    const icon = screen.getByTitle('Микрофон выключен');
    expect(icon).toBeInTheDocument();
    expect(icon.textContent).toBe('🔇');
  });

  it('не показывает индикатор микрофона когда не замьючен', () => {
    render(<VideoTile stream={createStream()} userName="Carol" isMuted={false} />);

    expect(screen.queryByTitle('Микрофон выключен')).toBeNull();
  });
});
