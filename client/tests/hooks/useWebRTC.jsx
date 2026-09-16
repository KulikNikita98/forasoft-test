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
      // addTransceiver должен складывать слот в _transceivers этого pc
      pc.addTransceiver = vi.fn((kindOrTrack, init) => {
        const t = makeTransceiver(kindOrTrack, init);
        pc._transceivers.push(t);
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

    // Слоты audio/video зарезервированы через addTransceiver в фиксированном порядке
    expect(mockPeerConnection.addTransceiver).toHaveBeenCalledTimes(2);
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

  it('привязывает локальные треки к transceiver-слотам через replaceTrack', async () => {
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

    // Треки навешиваются на зарезервированные слоты через sender.replaceTrack,
    // а не addTrack — иначе порядок m-lines в SDP расходился бы между пирами
    const transceivers = mockPeerConnection._transceivers;
    expect(transceivers).toHaveLength(2);
    // Первый слот — audio, второй — video (фиксированный порядок)
    expect(transceivers[0].sender.setStreams).toHaveBeenCalled();
    expect(transceivers[1].sender.setStreams).toHaveBeenCalled();
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

  it('пересоздаёт соединение при InvalidAccessError (рассинхрон m-lines)', async () => {
    // setRemoteDescription падает с InvalidAccessError на первом вызове →
    // соединение должно пересоздаться, а не остаться мёртвым.
    const err = new Error('order of m-lines does not match');
    err.name = 'InvalidAccessError';
    let firstCall = true;
    // Переопределяем на уровне общих spies — применится ко всем создаваемым PC
    spies.setRemoteDescription = vi.fn(function (desc) {
      if (firstCall) {
        firstCall = false;
        return Promise.reject(err);
      }
      this.remoteDescription = desc;
      this.signalingState = desc?.type === 'offer' ? 'have-remote-offer' : 'stable';
      return Promise.resolve();
    });

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
      await onOffer({ from: 'zzz-peer', sdp: { type: 'offer', sdp: 'x' } });
    });

    // Битое соединение закрыто и пересоздано
    expect(spies.close).toHaveBeenCalled();
    // Второе соединение создано (RTCPeerConnection вызван повторно)
    expect(RTCPeerConnection.mock.calls.length).toBeGreaterThan(1);
  });

  it('очередь negotiation: повторный onnegotiationneeded во время активной откладывается и запускается после answer', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    // Создаём соединение как инициатор — уходит первый offer
    await act(async () => {
      await result.current.createPeerConnection('zzz-peer', true);
    });

    const offersBefore = mockSocket.emit.mock.calls.filter(([e]) => e === 'offer').length;
    expect(offersBefore).toBe(1);
    // После createOffer соединение в have-local-offer (не stable)
    expect(mockPeerConnection.signalingState).toBe('have-local-offer');

    // Пока ждём answer, приходит запрос на renegotiation (напр. включили камеру).
    // Он не должен потеряться — откладывается, т.к. pc не в stable.
    act(() => {
      mockPeerConnection.onnegotiationneeded();
    });

    // Новый offer пока НЕ ушёл (соединение ещё не stable)
    const offersMid = mockSocket.emit.mock.calls.filter(([e]) => e === 'offer').length;
    expect(offersMid).toBe(1);

    // Приходит answer → соединение возвращается в stable → отложенный offer уходит
    const onAnswer = getHandler('answer');
    await act(async () => {
      await onAnswer({ from: 'zzz-peer', sdp: { type: 'answer', sdp: 'a' } });
    });

    const offersAfter = mockSocket.emit.mock.calls.filter(([e]) => e === 'offer').length;
    expect(offersAfter).toBe(2);
  });

  it('glare: инициирует только к участникам с бо́льшим id, к меньшим ждёт offer', async () => {
    // Наш id 'aaa-me' < 'zzz-peer' (инициируем) и > 'aa-peer' (ждём)
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
        participants: [{ socketId: 'zzz-peer' }, { socketId: 'aa-peer' }]
      });
    });

    // Offer уходит только тому, чей id больше нашего
    const offerTargets = mockSocket.emit.mock.calls
      .filter(([event]) => event === 'offer')
      .map(([, payload]) => payload.targetSocketId);
    expect(offerTargets).toEqual(['zzz-peer']);
  });

  it('glare: новичок с бо́льшим id не инициирует, а ждёт offer (polite)', async () => {
    // Наш id 'aaa-me' > 'aa-peer' → мы polite, offer не шлём
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
    });

    expect(mockPeerConnection.createOffer).not.toHaveBeenCalled();
    const offerCalls = mockSocket.emit.mock.calls.filter(([e]) => e === 'offer');
    expect(offerCalls).toHaveLength(0);
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
      await result.current.createPeerConnection('peer-1', false);
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
      await result.current.createPeerConnection('peer-1', false);
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

  it('буферизует кандидат во время (ре)негоциации (signalingState !== stable)', async () => {
    const { result } = renderHook(() =>
      useWebRTC({
        socket: mockSocket,
        localStream: mockLocalStream,
        onRemoteStream,
        onPeerLeft
      })
    );

    // remoteDescription есть, но идёт негоциация — браузер отклонил бы кандидат
    await act(async () => {
      await result.current.createPeerConnection('peer-1', false);
      mockPeerConnection.remoteDescription = { type: 'offer' };
      mockPeerConnection.signalingState = 'have-local-offer';
    });

    const onIce = getHandler('ice-candidate');
    await act(async () => {
      await onIce({ from: 'peer-1', candidate: { candidate: 'c1' } });
    });

    // Кандидат отложен, а не применён к неготовому соединению
    expect(mockPeerConnection.addIceCandidate).not.toHaveBeenCalled();
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
      await result.current.createPeerConnection('peer-1', false);
    });

    act(() => {
      mockPeerConnection.iceConnectionState = 'connected';
      mockPeerConnection.oniceconnectionstatechange();
    });

    expect(onConnectionStateChange).toHaveBeenCalledWith('peer-1', 'connected');
  });

  it('закрывает соединение сразу при iceConnectionState=failed', async () => {
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

    act(() => {
      mockPeerConnection.iceConnectionState = 'failed';
      mockPeerConnection.oniceconnectionstatechange();
    });

    expect(mockPeerConnection.close).toHaveBeenCalled();
    expect(onPeerLeft).toHaveBeenCalledWith('peer-1');
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
      await result.current.createPeerConnection('peer-1', false);
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
      await result.current.createPeerConnection('peer-1', false);
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
