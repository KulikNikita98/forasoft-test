import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useMedia } from '../../src/hooks/useMedia.js';

describe('useMedia', () => {
  let mockStream;
  let mockAudioTrack;
  let mockVideoTrack;

  beforeEach(() => {
    // Моки для MediaStream и треков
    mockAudioTrack = {
      kind: 'audio',
      enabled: true,
      stop: vi.fn()
    };

    mockVideoTrack = {
      kind: 'video',
      enabled: true,
      stop: vi.fn()
    };

    mockStream = {
      getTracks: vi.fn(() => [mockAudioTrack, mockVideoTrack]),
      getAudioTracks: vi.fn(() => [mockAudioTrack]),
      getVideoTracks: vi.fn(() => [mockVideoTrack]),
      removeTrack: vi.fn()
    };

    // Мок getUserMedia
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn(() => Promise.resolve(mockStream))
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('инициализируется с null stream', () => {
    const { result } = renderHook(() => useMedia());

    expect(result.current.localStream).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('запрашивает getUserMedia при autoStart', async () => {
    const { result } = renderHook(() => useMedia({ autoStart: true }));

    await waitFor(() => {
      expect(result.current.localStream).toBe(mockStream);
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      }
    });
  });

  it('запускает медиа вручную через startMedia', async () => {
    const { result } = renderHook(() => useMedia());

    await act(async () => {
      await result.current.startMedia();
    });

    expect(result.current.localStream).toBe(mockStream);
    expect(result.current.isAudioEnabled).toBe(true);
    expect(result.current.isVideoEnabled).toBe(true);
  });

  it('initialState держит видео выключенным при включении только микрофона', async () => {
    // getUserMedia отдаёт оба трека enabled=true, но пользователь включал
    // только микрофон — видео-трек должен остаться выключенным (баг с автовключением)
    const { result } = renderHook(() => useMedia());

    await act(async () => {
      await result.current.startMedia({ initialState: { audio: true, video: false } });
    });

    expect(mockAudioTrack.enabled).toBe(true);
    expect(mockVideoTrack.enabled).toBe(false);
    expect(result.current.isAudioEnabled).toBe(true);
    expect(result.current.isVideoEnabled).toBe(false);
  });

  it('initialState держит микрофон выключенным при включении только камеры', async () => {
    const { result } = renderHook(() => useMedia());

    await act(async () => {
      await result.current.startMedia({ initialState: { audio: false, video: true } });
    });

    expect(mockAudioTrack.enabled).toBe(false);
    expect(mockVideoTrack.enabled).toBe(true);
    expect(result.current.isAudioEnabled).toBe(false);
    expect(result.current.isVideoEnabled).toBe(true);
  });

  it('принимает кастомные constraints через startMedia', async () => {
    const { result } = renderHook(() => useMedia());
    const custom = { audio: true, video: false };

    await act(async () => {
      await result.current.startMedia({ constraints: custom });
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(custom);
  });

  it('останавливает все треки при stopMedia', async () => {
    const { result } = renderHook(() => useMedia({ autoStart: true }));

    await waitFor(() => {
      expect(result.current.localStream).toBeTruthy();
    });

    act(() => {
      result.current.stopMedia();
    });

    expect(mockAudioTrack.stop).toHaveBeenCalled();
    expect(mockVideoTrack.stop).toHaveBeenCalled();
    expect(result.current.localStream).toBeNull();
  });

  it('переключает аудио через toggleAudio', async () => {
    const { result } = renderHook(() => useMedia({ autoStart: true }));

    await waitFor(() => {
      expect(result.current.localStream).toBeTruthy();
    });

    act(() => {
      result.current.toggleAudio(false);
    });

    expect(mockAudioTrack.enabled).toBe(false);
    expect(result.current.isAudioEnabled).toBe(false);

    act(() => {
      result.current.toggleAudio(true);
    });

    expect(mockAudioTrack.enabled).toBe(true);
    expect(result.current.isAudioEnabled).toBe(true);
  });

  it('переключает видео через toggleVideo', async () => {
    const { result } = renderHook(() => useMedia({ autoStart: true }));

    await waitFor(() => {
      expect(result.current.localStream).toBeTruthy();
    });

    act(() => {
      result.current.toggleVideo(false);
    });

    expect(mockVideoTrack.enabled).toBe(false);
    expect(result.current.isVideoEnabled).toBe(false);
  });

  it('обрабатывает ошибку доступа (NotAllowedError)', async () => {
    navigator.mediaDevices.getUserMedia = vi.fn(() =>
      Promise.reject({ name: 'NotAllowedError' })
    );

    const { result } = renderHook(() => useMedia());

    await act(async () => {
      await result.current.startMedia();
    });

    expect(result.current.error).toContain('отклонен');
    expect(result.current.localStream).toBeNull();
  });

  it('обрабатывает отсутствие устройств (NotFoundError)', async () => {
    navigator.mediaDevices.getUserMedia = vi.fn(() =>
      Promise.reject({ name: 'NotFoundError' })
    );

    const { result } = renderHook(() => useMedia());

    await act(async () => {
      await result.current.startMedia();
    });

    expect(result.current.error).toContain('не найдены');
  });

  it('очищает ресурсы при размонтировании', async () => {
    const { result, unmount } = renderHook(() => useMedia({ autoStart: true }));

    await waitFor(() => {
      expect(result.current.localStream).toBeTruthy();
    });

    unmount();

    expect(mockAudioTrack.stop).toHaveBeenCalled();
    expect(mockVideoTrack.stop).toHaveBeenCalled();
  });

  it('навешивает onended на треки после старта', async () => {
    const { result } = renderHook(() => useMedia({ autoStart: true }));

    await waitFor(() => {
      expect(result.current.localStream).toBeTruthy();
    });

    expect(typeof mockAudioTrack.onended).toBe('function');
    expect(typeof mockVideoTrack.onended).toBe('function');
  });

  it('выключает аудио и вызывает onDeviceLost при потере микрофона', async () => {
    const onDeviceLost = vi.fn();
    const { result } = renderHook(() => useMedia({ autoStart: true, onDeviceLost }));

    await waitFor(() => {
      expect(result.current.localStream).toBeTruthy();
    });

    act(() => {
      mockAudioTrack.onended();
    });

    expect(result.current.isAudioEnabled).toBe(false);
    expect(onDeviceLost).toHaveBeenCalledWith('audio');
  });

  it('выключает видео и вызывает onDeviceLost при потере камеры', async () => {
    const onDeviceLost = vi.fn();
    const { result } = renderHook(() => useMedia({ autoStart: true, onDeviceLost }));

    await waitFor(() => {
      expect(result.current.localStream).toBeTruthy();
    });

    act(() => {
      mockVideoTrack.onended();
    });

    expect(result.current.isVideoEnabled).toBe(false);
    expect(onDeviceLost).toHaveBeenCalledWith('video');
  });
});
