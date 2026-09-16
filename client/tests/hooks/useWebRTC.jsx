import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebRTC } from '../../src/hooks/useWebRTC.js';

describe('useWebRTC', () => {
  let mockSocket;
  let mockLocalStream;
  // Последнее созданное соединение — к нему обращаются тесты с одним пиром
  let mockPeerConnection;
  // Спаи общие для всех соединений, чтобы считать вызовы суммарно
  let spies;
  let onRemoteStream;
  let onPeerLeft;

  beforeEach(() => {
    // socket.id нужен для glare-правила: инициирует тот, чей id меньше.
    // 'aaa-me' < 'peer-*', значит в тестах мы — инициатор.
    mockSocket = {
      id: 'aaa-me',
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    };

    const audioTrack = { kind: 'audio', id: 'a1' };
    const videoTrack = { kind: 'video', id: 'v1' };
    mockLocalStream = {
      getTracks: vi.fn(() => [audioTrack, videoTrack]),
      getAudioTracks: vi.fn(() => [audioTrack]),
      getVideoTracks: vi.fn(() => [videoTrack])
    };

    // Фабрика transceiver-мока: sender с replaceTrack/setStreams
    const makeTransceiver = (kindOrTrack, init) => {
      const track = typeof kindOrTrack === 'string' ? null : kindOrTrack;
      const kind = typeof kindOrTrack === 'string' ? kindOrTrack : kindOrTrack?.kind;
      const transceiver = {
        _kind: kind,
        direction: init?.direction || 'sendrecv',
        stopped: false,
        sender: {
          track,
          replaceTrack: vi.fn(function (t) { this.track = t; return Promise.resolve(); }),
          setStreams: vi.fn()
        },
        receiver: { track: null }
      };
      return transceiver;
    };

    // set*Description меняют signalingState через this — как настоящая state machine
    spies = {
      addTransceiver: vi.fn((kindOrTrack, init) => makeTransceiver(kindOrTrack, init)),
      getSenders: vi.fn(function () {
        return (this._transceivers || []).map((t) => t.sender);
      }),
      getTransceivers: vi.fn(function () {
        return this._transceivers || [];
      }),
      createOffer: vi.fn(() => Promise.resolve({ type: 'offer', sdp: 'mock-sdp' })),
      createAnswer: vi.fn(() => Promise.resolve({ type: 'answer', sdp: 'mock-sdp' })),
      setLocalDescription: vi.fn(function (desc) {
        if (desc?.type === 'rollback') {
          this.signalingState = 'stable';
          return Promise.resolve();
        }
        // Вызов с offer из createOffer или answer
        const description = desc ?? { type: 'offer', sdp: 'auto-sdp' };
        this.localDescription = description;
        this.signalingState =
          description.type === 'answer' ? 'stable' : 'have-local-offer';
        return Promise.resolve();
      }),
      setRemoteDescription: vi.fn(function (desc) {
        this.remoteDescription = desc;
        this.signalingState = desc?.type === 'offer' ? 'have-remote-offer' : 'stable';
        return Promise.resolve();
      }),
      addIceCandidate: vi.fn(() => Promise.resolve()),
      restartIce: vi.fn(),
      close: vi.fn()
    };

    // Каждое соединение получает собственное состояние, но общие спаи.
    // _transceivers накапливает созданные addTransceiver'ом слоты.
    global.RTCPeerConnection = vi.fn(function () {
      const pc = {
        ...spies,
        _transceivers: [],
        signalingState: 'stable',
        connectionState: 'connected',
        iceConnectionState: 'connected',
        remoteDescription: null,
        localDescription: null,
        ontrack: null,
        onicecandidate: null,
        onnegotiationneeded: null,
        onconnectionstatechange: null,
        oniceconnectionstatechange: null
      };
      // addTransceiver складывает слот и эмулирует браузерный onnegotiationneeded:
      // реальный браузер поднимает его асинхронно после добавления transceiver'а.
      pc.addTransceiver = vi.fn((kindOrTrack, init) => {
        const t = makeTransceiver(kindOrTrack, init);
        pc._transceivers.push(t);
        queueMicrotask(() => pc.onnegotiationneeded?.());
        return t;
      });
      mockPeerConnection = pc;
      return pc;
    });
    global.RTCSessionDescription = vi.fn(function (desc) {
      return desc;
    });
    global.RTCIceCandidate = vi.fn(function (candidate) {
      return candidate;
    });
    global.MediaStream = vi.fn(function () {
      const tracks = [];
      return {
        getTracks: () => tracks,
        addTrack: (t) => { if (!tracks.includes(t)) tracks.push(t); }
      };
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

  it('создаёт соединение и отправляет offer через onnegotiationneeded', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-123');
      // Дать микротаскам addTransceiver → onnegotiationneeded отработать
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(RTCPeerConnection).toHaveBeenCalledWith({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Слоты audio/video зарезервированы через addTransceiver в фиксированном порядке
    expect(mockPeerConnection.addTransceiver).toHaveBeenCalledTimes(2);
    // onnegotiationneeded → setLocalDescription() → offer ушёл
    expect(mockSocket.emit).toHaveBeenCalledWith('offer', expect.objectContaining({
      targetSocketId: 'peer-123'
    }));

    expect(result.current.peers.size).toBe(1);
  });

  it('создаёт соединение с зарезервированными transceiver-слотами', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-456');
    });

    expect(mockPeerConnection.addTransceiver).toHaveBeenCalledTimes(2);
    expect(result.current.peers.size).toBe(1);
  });

  it('резервирует transceiver-слоты с локальными треками (audio, затем video)', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-123');
    });

    // Транссиверы созданы в фиксированном порядке (audio, video) с треками —
    // это даёт одинаковый порядок m-lines у всех пиров
    const calls = mockPeerConnection.addTransceiver.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toEqual({ kind: 'audio', id: 'a1' });
    expect(calls[1][0]).toEqual({ kind: 'video', id: 'v1' });
    // direction sendrecv, чтобы одновременно слать и принимать
    expect(calls[0][1].direction).toBe('sendrecv');
    expect(calls[1][1].direction).toBe('sendrecv');
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
      await result.current.createPeerConnection('peer-123');
    });

    // event.streams пуст → трек агрегируется в собственный MediaStream пира
    const remoteTrack = { id: 't1', kind: 'video' };
    act(() => {
      mockPeerConnection.ontrack({ track: remoteTrack, streams: [] });
    });

    expect(onRemoteStream).toHaveBeenCalledWith('peer-123', expect.any(Object));
    const [, stream] = onRemoteStream.mock.calls[0];
    expect(stream.getTracks()).toContain(remoteTrack);
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
      await result.current.createPeerConnection('peer-123');
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
      await result.current.createPeerConnection('peer-123');
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
      await result.current.createPeerConnection('peer-1');
      await result.current.createPeerConnection('peer-2');
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
      await result.current.createPeerConnection('peer-123');
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

  it('при room-joined создаёт соединение и шлёт offer каждому участнику', async () => {
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
      // Дать addTransceiver → onnegotiationneeded (микротаски) отработать
      await Promise.resolve();
      await Promise.resolve();
    });

    // onnegotiationneeded у каждого соединения → offer каждому участнику
    const offerTargets = mockSocket.emit.mock.calls
      .filter(([e]) => e === 'offer')
      .map(([, payload]) => payload.targetSocketId);
    expect(offerTargets).toContain('peer-1');
    expect(offerTargets).toContain('peer-2');
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

    // Приняли offer и ответили answer (setLocalDescription без аргументов
    // сам создаёт answer из remote-offer состояния)
    expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledWith('answer', expect.objectContaining({
      targetSocketId: 'peer-1'
    }));
  });

  it('glare: невежливый пир (меньший id) игнорирует конфликтующий offer', async () => {
    // Наш id 'aaa-me' < 'zzz-peer' → мы невежливы к zzz-peer
    renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    // Создаём соединение и доводим его до состояния «делаем свой offer»
    const onRoomJoined = getHandler('room-joined');
    await act(async () => {
      onRoomJoined({ participants: [{ socketId: 'zzz-peer' }] });
      await Promise.resolve();
      await Promise.resolve();
    });

    // Симулируем коллизию: мы не в stable (уже отправили свой offer)
    mockPeerConnection.signalingState = 'have-local-offer';
    const emitsBefore = mockSocket.emit.mock.calls.filter(([e]) => e === 'answer').length;

    const onOffer = getHandler('offer');
    await act(async () => {
      await onOffer({ from: 'zzz-peer', sdp: { type: 'offer', sdp: 'x' } });
    });

    // Невежливый пир проигнорировал чужой offer — answer не отправлен
    const emitsAfter = mockSocket.emit.mock.calls.filter(([e]) => e === 'answer').length;
    expect(emitsAfter).toBe(emitsBefore);
  });

  it('glare: вежливый пир (больший id) принимает offer при коллизии', async () => {
    // Наш id 'aaa-me' > 'aa-peer' → мы вежливы к aa-peer
    renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    const onUserJoined = getHandler('user-joined');
    await act(async () => {
      onUserJoined({ socketId: 'aa-peer' });
      await Promise.resolve();
      await Promise.resolve();
    });

    // Коллизия: мы не в stable, но вежливы → принимаем offer и отвечаем
    mockPeerConnection.signalingState = 'have-local-offer';

    const onOffer = getHandler('offer');
    await act(async () => {
      await onOffer({ from: 'aa-peer', sdp: { type: 'offer', sdp: 'x' } });
    });

    // Вежливый пир принял offer (rollback внутри setRemoteDescription) и ответил
    expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalled();
    expect(mockSocket.emit).toHaveBeenCalledWith('answer', expect.objectContaining({
      targetSocketId: 'aa-peer'
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
      await result.current.createPeerConnection('peer-1');
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
      await onIce({ from: 'peer-1', candidate: { candidate: 'c1' } });
    });

    expect(mockPeerConnection.addIceCandidate).not.toHaveBeenCalled();
  });

  it('читает ICE-кандидат из поля from (регрессия: раньше читали fromSocketId)', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    // Соединение готово принимать кандидаты: есть remoteDescription И stable
    await act(async () => {
      await result.current.createPeerConnection('peer-1');
      mockPeerConnection.remoteDescription = { type: 'offer' };
      mockPeerConnection.signalingState = 'stable';
    });

    const onIce = getHandler('ice-candidate');
    await act(async () => {
      await onIce({ from: 'peer-1', candidate: { candidate: 'c1' } });
    });

    // Кандидат нашёл своё соединение по from и применился — ICE может стартовать
    expect(mockPeerConnection.addIceCandidate).toHaveBeenCalledWith({ candidate: 'c1' });
  });

  it('игнорирует пустой ICE-кандидат (end-of-candidates)', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-1');
      mockPeerConnection.remoteDescription = { type: 'offer' };
      mockPeerConnection.signalingState = 'stable';
    });

    const onIce = getHandler('ice-candidate');
    // Пустой candidate (маркер конца сбора) не должен доходить до addIceCandidate
    await act(async () => {
      await onIce({ from: 'peer-1', candidate: { candidate: '' } });
      await onIce({ from: 'peer-1', candidate: null });
    });

    expect(mockPeerConnection.addIceCandidate).not.toHaveBeenCalled();
  });

  it('применяет ICE-кандидат сразу после установки remoteDescription', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    // remoteDescription установлен — кандидат можно добавлять
    await act(async () => {
      await result.current.createPeerConnection('peer-1');
      mockPeerConnection.remoteDescription = { type: 'offer' };
    });

    const onIce = getHandler('ice-candidate');
    await act(async () => {
      await onIce({ from: 'peer-1', candidate: { candidate: 'c1' } });
    });

    expect(mockPeerConnection.addIceCandidate).toHaveBeenCalled();
  });

  it('вызывает onConnectionStateChange при смене ICE-состояния', async () => {
    const onConnectionStateChange = vi.fn();
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft,
        onConnectionStateChange
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-1');
    });

    act(() => {
      mockPeerConnection.iceConnectionState = 'connected';
      mockPeerConnection.oniceconnectionstatechange();
    });

    expect(onConnectionStateChange).toHaveBeenCalledWith('peer-1', 'connected');
  });

  it('пытается восстановить ICE (restartIce) при iceConnectionState=failed', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-1');
    });

    act(() => {
      mockPeerConnection.iceConnectionState = 'failed';
      mockPeerConnection.oniceconnectionstatechange();
    });

    // Вместо закрытия пробуем восстановить соединение через restartIce
    expect(mockPeerConnection.restartIce).toHaveBeenCalled();
  });

  it('ждёт 5 сек перед закрытием при iceConnectionState=disconnected', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-1');
    });

    act(() => {
      mockPeerConnection.iceConnectionState = 'disconnected';
      mockPeerConnection.oniceconnectionstatechange();
    });

    // Сразу не закрывается
    expect(mockPeerConnection.close).not.toHaveBeenCalled();

    // Спустя 5 сек — закрывается (состояние осталось disconnected)
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockPeerConnection.close).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('отменяет закрытие если соединение восстановилось после disconnected', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    await act(async () => {
      await result.current.createPeerConnection('peer-1');
    });

    act(() => {
      mockPeerConnection.iceConnectionState = 'disconnected';
      mockPeerConnection.oniceconnectionstatechange();
    });

    // Восстановление до истечения таймера
    act(() => {
      mockPeerConnection.iceConnectionState = 'connected';
      mockPeerConnection.oniceconnectionstatechange();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockPeerConnection.close).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
