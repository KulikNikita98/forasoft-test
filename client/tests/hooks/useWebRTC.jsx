import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebRTC } from '../../src/hooks/useWebRTC.js';

describe('useWebRTC', () => {
  let mockSocket;
  let mockLocalStream;
  let mockPeerConnection;
  let onRemoteStream;
  let onPeerLeft;

  beforeEach(() => {
    // Мок Socket.io
    mockSocket = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    };

    // Мок MediaStream
    mockLocalStream = {
      getTracks: vi.fn(() => [
        { kind: 'audio' },
        { kind: 'video' }
      ])
    };

    // Мок RTCPeerConnection
    mockPeerConnection = {
      addTrack: vi.fn(),
      createOffer: vi.fn(() => Promise.resolve({ type: 'offer', sdp: 'mock-sdp' })),
      createAnswer: vi.fn(() => Promise.resolve({ type: 'answer', sdp: 'mock-sdp' })),
      setLocalDescription: vi.fn(() => Promise.resolve()),
      setRemoteDescription: vi.fn(function () {
        this.remoteDescription = { type: 'offer' };
        return Promise.resolve();
      }),
      addIceCandidate: vi.fn(() => Promise.resolve()),
      close: vi.fn(),
      connectionState: 'connected',
      remoteDescription: null,
      ontrack: null,
      onicecandidate: null,
      onconnectionstatechange: null
    };

    global.RTCPeerConnection = vi.fn(function() {
      return mockPeerConnection;
    });
    global.RTCSessionDescription = vi.fn(function (desc) {
      return desc;
    });
    global.RTCIceCandidate = vi.fn(function (candidate) {
      return candidate;
    });

    onRemoteStream = vi.fn();
    onPeerLeft = vi.fn();
  });

  it('инициализируется с пустой Map пиров', () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    expect(result.current.peers.size).toBe(0);
  });

  it('создает peer connection как инициатор', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-123', true);
    });

    expect(RTCPeerConnection).toHaveBeenCalledWith({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    expect(mockPeerConnection.addTrack).toHaveBeenCalledTimes(2);
    expect(mockPeerConnection.createOffer).toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledWith('offer', {
      targetSocketId: 'peer-123',
      sdp: { type: 'offer', sdp: 'mock-sdp' }
    });

    expect(result.current.peers.size).toBe(1);
  });

  it('создает peer connection как не-инициатор', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-456', false);
    });

    expect(mockPeerConnection.createOffer).not.toHaveBeenCalled();
    expect(result.current.peers.size).toBe(1);
  });

  it('добавляет локальные треки в peer connection', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-123', false);
    });

    expect(mockPeerConnection.addTrack).toHaveBeenCalledWith(
      { kind: 'audio' },
      mockLocalStream
    );
    expect(mockPeerConnection.addTrack).toHaveBeenCalledWith(
      { kind: 'video' },
      mockLocalStream
    );
  });

  it('вызывает onRemoteStream при получении remote track', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-123', false);
    });

    const mockRemoteStream = { id: 'remote-stream' };

    act(() => {
      mockPeerConnection.ontrack({ streams: [mockRemoteStream] });
    });

    expect(onRemoteStream).toHaveBeenCalledWith('peer-123', mockRemoteStream);
  });

  it('отправляет ICE candidates через socket', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-123', false);
    });

    const mockCandidate = { candidate: 'ice-candidate' };

    act(() => {
      mockPeerConnection.onicecandidate({ candidate: mockCandidate });
    });

    expect(mockSocket.emit).toHaveBeenCalledWith('ice-candidate', {
      targetSocketId: 'peer-123',
      candidate: mockCandidate
    });
  });

  it('закрывает peer connection', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-123', false);
    });

    act(() => {
      result.current.closePeerConnection('peer-123');
    });

    expect(mockPeerConnection.close).toHaveBeenCalled();
    expect(result.current.peers.size).toBe(0);
    expect(onPeerLeft).toHaveBeenCalledWith('peer-123');
  });

  it('закрывает все соединения', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-1', false);
      await result.current.createPeerConnection('peer-2', false);
    });

    expect(result.current.peers.size).toBe(2);

    act(() => {
      result.current.closeAllConnections();
    });

    expect(mockPeerConnection.close).toHaveBeenCalledTimes(2);
    expect(result.current.peers.size).toBe(0);
  });

  it('слушает socket события для signaling', () => {
    renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    expect(mockSocket.on).toHaveBeenCalledWith('offer', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('answer', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('ice-candidate', expect.any(Function));
  });

  it('очищает соединения при размонтировании', async () => {
    const { result, unmount } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-123', false);
    });

    unmount();

    expect(mockPeerConnection.close).toHaveBeenCalled();
    expect(mockSocket.off).toHaveBeenCalledWith('offer', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('answer', expect.any(Function));
    expect(mockSocket.off).toHaveBeenCalledWith('ice-candidate', expect.any(Function));
  });

  // Хелпер: получить обработчик socket-события по имени
  const getHandler = (eventName) => {
    const call = mockSocket.on.mock.calls.find(([name]) => name === eventName);
    return call?.[1];
  };

  it('инициирует offer каждому существующему участнику при room-joined (glare rule)', async () => {
    renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    const onRoomJoined = getHandler('room-joined');

    await act(async () => {
      onRoomJoined({
        participants: [{ socketId: 'peer-1' }, { socketId: 'peer-2' }]
      });
    });

    // Новичок создаёт offer каждому из двух существующих участников
    expect(mockPeerConnection.createOffer).toHaveBeenCalledTimes(2);
    expect(mockSocket.emit).toHaveBeenCalledWith('offer', expect.objectContaining({
      targetSocketId: 'peer-1'
    }));
    expect(mockSocket.emit).toHaveBeenCalledWith('offer', expect.objectContaining({
      targetSocketId: 'peer-2'
    }));
  });

  it('создаёт PC лениво и отвечает answer на входящий offer', async () => {
    renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    const onOffer = getHandler('offer');

    await act(async () => {
      await onOffer({ from: 'peer-1', sdp: { type: 'offer', sdp: 'x' } });
    });

    // Существующий участник только отвечает — createOffer не вызывается
    expect(mockPeerConnection.createOffer).not.toHaveBeenCalled();
    expect(mockPeerConnection.createAnswer).toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledWith('answer', expect.objectContaining({
      targetSocketId: 'peer-1'
    }));
  });

  it('закрывает соединение при user-left', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-1', false);
    });

    const onUserLeft = getHandler('user-left');

    act(() => {
      onUserLeft({ socketId: 'peer-1' });
    });

    expect(mockPeerConnection.close).toHaveBeenCalled();
    expect(onPeerLeft).toHaveBeenCalledWith('peer-1');
  });

  it('буферизует ICE-кандидаты до установки remoteDescription', async () => {
    renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    const onIce = getHandler('ice-candidate');

    // Кандидат приходит раньше, чем создан PC → буферизуется, не падает
    await act(async () => {
      await onIce({ fromSocketId: 'peer-1', candidate: { candidate: 'c1' } });
    });

    expect(mockPeerConnection.addIceCandidate).not.toHaveBeenCalled();
  });
});
