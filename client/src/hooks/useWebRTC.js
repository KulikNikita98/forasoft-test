import { useEffect, useRef, useState, useCallback } from 'react';
import config from '../config/index.js';


/**
 * Снимок SDP-релевантного состояния pc.
 *
 * Важно: сравниваем track.id, а не только kind — replaceTrack (null → track)
 * не меняет набор kind'ов sender'ов, но требует renegotiation, чтобы удалённый
 * пир получил SSRC и msid. Без track.id в снапшоте эффект localStream не увидит
 * разницы и не запустит renegotiation.
 */
function snapshotPcState(pc) {
  const senders = pc
    .getSenders()
    .map((s) => `${s.track?.kind ?? 'none'}:${s.track?.id ?? '-'}`)
    .join(',');
  const transceivers = pc
    .getTransceivers()
    .map((t) => {
      const kind = t.receiver?.track?.kind || t.sender?.track?.kind || '?';
      return `${kind}:${t.direction}`;
    })
    .join(',');
  return `${senders}|${transceivers}`;
}

/**
 * useWebRTC — управление RTCPeerConnection для mesh-топологии.
 *
 * Perfect negotiation (polite/impolite), фиксированный порядок m-lines через
 * addTransceiver, буферизация ICE, корректная обработка позднего localStream
 * (transceiver.direction = sendrecv всегда), агрегация удалённых треков по
 * socketId (audio + video в один MediaStream).
 */
export function useWebRTC({
  socket,
  localStream,
  onRemoteStream,
  onPeerLeft,
  onConnectionStateChange
}) {
  const peersRef = useRef(new Map());
  const [peers, setPeers] = useState(new Map());

  const socketRef = useRef(socket);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  const localStreamRef = useRef(localStream);
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const pendingCandidatesRef = useRef(new Map());
  const pendingInitiatorsRef = useRef(new Set());
  const disconnectTimersRef = useRef(new Map());
  const makingOfferRef = useRef(new Map());
  const renegotiatePendingRef = useRef(new Map());

  // socketId -> MediaStream, в который мы собираем треки, если удалённый пир
  // не передал msid (event.streams пустой). Иначе audio и video оказались бы
  // в разных MediaStream и второй затёр бы первый в состоянии RoomScreen.
  const remoteStreamsRef = useRef(new Map());

  const callbacksRef = useRef({ onRemoteStream, onPeerLeft, onConnectionStateChange });
  useEffect(() => {
    callbacksRef.current = { onRemoteStream, onPeerLeft, onConnectionStateChange };
  }, [onRemoteStream, onPeerLeft, onConnectionStateChange]);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const emit = useCallback((event, payload) => {
    const s = socketRef.current;
    if (s) s.emit(event, payload);
  }, []);

  const clearDisconnectTimer = useCallback((socketId) => {
    const timer = disconnectTimersRef.current.get(socketId);
    if (timer) {
      clearTimeout(timer);
      disconnectTimersRef.current.delete(socketId);
    }
  }, []);

  const closePeerConnection = useCallback((socketId, { notify = true } = {}) => {
    const pc = peersRef.current.get(socketId);
    if (!pc) return;

    delete pc._streamUpdateHandler;
    try { pc.close(); } catch (_) { /* ignore */ }

    peersRef.current.delete(socketId);
    pendingCandidatesRef.current.delete(socketId);
    makingOfferRef.current.delete(socketId);
    renegotiatePendingRef.current.delete(socketId);
    pendingInitiatorsRef.current.delete(socketId);
    remoteStreamsRef.current.delete(socketId);
    clearDisconnectTimer(socketId);

    setPeers(new Map(peersRef.current));

    if (notify && callbacksRef.current.onPeerLeft) {
      callbacksRef.current.onPeerLeft(socketId);
    }
  }, [clearDisconnectTimer]);

  // ---------------------------------------------------------------------------
  // Negotiation
  // ---------------------------------------------------------------------------

  const handleNegotiationNeeded = useCallback(async (socketId) => {
    const pc = peersRef.current.get(socketId);
    if (!pc) return;

    if (makingOfferRef.current.get(socketId)) {
      renegotiatePendingRef.current.set(socketId, true);
      return;
    }

    if (pc.signalingState !== 'stable') {
      renegotiatePendingRef.current.set(socketId, true);
      return;
    }

    let resolveDone;
    const donePromise = new Promise((r) => { resolveDone = r; });
    makingOfferRef.current.set(socketId, donePromise);
    renegotiatePendingRef.current.delete(socketId);

    try {
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') {
        renegotiatePendingRef.current.set(socketId, true);
        return;
      }
      await pc.setLocalDescription(offer);
      emit('offer', { targetSocketId: socketId, sdp: pc.localDescription });
    } catch (err) {
      console.error('[useWebRTC] negotiationneeded error:', err);
    } finally {
      makingOfferRef.current.delete(socketId);
      resolveDone();

      if (renegotiatePendingRef.current.get(socketId)) {
        renegotiatePendingRef.current.delete(socketId);
        const current = peersRef.current.get(socketId);
        if (current && current.signalingState === 'stable') {
          handleNegotiationNeeded(socketId);
        }
      }
    }
  }, [emit]);

  // ---------------------------------------------------------------------------
  // Создание peer connection
  // ---------------------------------------------------------------------------

  const setupPeerConnection = useCallback((socketId, { polite }) => {
    const existing = peersRef.current.get(socketId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: config.webrtc.iceServers });
    pc._polite = polite;
    peersRef.current.set(socketId, pc);
    setPeers(new Map(peersRef.current));

    pendingCandidatesRef.current.delete(socketId);
    renegotiatePendingRef.current.delete(socketId);

    const stream = localStreamRef.current;
    const audioTrack = stream?.getAudioTracks()[0] || null;
    const videoTrack = stream?.getVideoTracks()[0] || null;

    // Transceiver'ы в фиксированном порядке (audio, video), сразу sendrecv.
    //
    // Если трека нет — streams пустой, браузер отправит m-line без msid,
    // direction в SDP может понизиться до recvonly. Это допустимо: после
    // появления трека мы делаем replaceTrack + setStreams и запускаем
    // renegotiation (см. эффект localStream), которая обновит SDP.
    let audioTransceiver = null;
    let videoTransceiver = null;
    try {
      audioTransceiver = pc.addTransceiver(audioTrack || 'audio', {
        direction: 'sendrecv',
        streams: audioTrack && stream ? [stream] : []
      });
      videoTransceiver = pc.addTransceiver(videoTrack || 'video', {
        direction: 'sendrecv',
        streams: videoTrack && stream ? [stream] : []
      });
    } catch (err) {
      console.error('[useWebRTC] addTransceiver error:', err);
    }

    /**
     * Навешивает актуальные локальные треки на transceiver'ы.
     * Возвращает true, если изменилось SDP-релевантное состояние.
     *
     * Ключевые моменты:
     * - direction поднимаем до sendrecv, если браузер его понизил;
     * - после replaceTrack вызываем sender.setStreams(stream), чтобы
     *   в SDP появился msid и удалённый пир получил event.streams;
     * - добавление трека туда, где его не было — требует renegotiation.
     */
    pc._streamUpdateHandler = async () => {
      const currentStream = localStreamRef.current;
      if (!currentStream) return false;

      const desiredAudio = currentStream.getAudioTracks()[0] || null;
      const desiredVideo = currentStream.getVideoTracks()[0] || null;

      let sdpRelevantChange = false;

      const bind = async (transceiver, track) => {
        if (!transceiver || transceiver.stopped) return;
        if (!track) return;

        if (transceiver.direction !== 'sendrecv' && transceiver.direction !== 'sendonly') {
          transceiver.direction = 'sendrecv';
          sdpRelevantChange = true;
        }

        const hadTrack = Boolean(transceiver.sender.track);

        if (transceiver.sender.track !== track) {
          try {
            await transceiver.sender.replaceTrack(track);
          } catch (err) {
            console.error('[useWebRTC] replaceTrack error:', err);
            return;
          }
        }

        // setStreams меняет msid в SDP. Если раньше streams не было —
        // это изменит SDP и потребует renegotiation, чтобы удалённый пир
        // увидел event.streams. Если streams уже были — setStreams идемпотентен.
        try {
          transceiver.sender.setStreams(currentStream);
        } catch (err) {
          console.warn('[useWebRTC] setStreams error:', err);
        }

        // Трек появился там, где его раньше не было — SDP должен обновиться,
        // чтобы удалённый пир получил SSRC и сгенерировал ontrack.
        if (!hadTrack) sdpRelevantChange = true;
      };

      await bind(audioTransceiver, desiredAudio);
      await bind(videoTransceiver, desiredVideo);

      return sdpRelevantChange;
    };

    // Первичная привязка (если stream уже есть). Renegotiation здесь не
    // запускаем — setup вызывается из createPeerConnection (там инициатор сам
    // создаст offer) или из handleOffer (там мы polite, ждём offer).
    pc._streamUpdateHandler().catch((err) => {
      console.error('[useWebRTC] initial bind error:', err);
    });

    // ontrack: агрегируем треки в один MediaStream на пир.
    //
    // event.streams пустой, когда удалённый пир не передал msid (типично для
    // addTransceiver без streams + replaceTrack). Без fallback ontrack молча
    // теряет трек — именно этот симптом «не все видеопотоки появляются».
    pc.ontrack = (event) => {
      const { track, streams } = event;
      if (!track) return;

      let remoteStream = streams && streams[0];

      if (!remoteStream) {
        // Переиспользуем уже созданный для этого пира MediaStream, чтобы
        // audio и video не разошлись по двум объектам и не затёрли друг друга
        // в setRemoteStreams.
        remoteStream = remoteStreamsRef.current.get(socketId);
        if (!remoteStream) {
          remoteStream = new MediaStream();
          remoteStreamsRef.current.set(socketId, remoteStream);
        }
        if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
          remoteStream.addTrack(track);
        }
      } else {
        // streams[0] пришёл от удалённого пира. Если у него два msid
        // (audio и video отдельно), мы получим два MediaStream, и второй
        // затрёт первый. Объединяем на всякий случай.
        const existing = remoteStreamsRef.current.get(socketId);
        if (existing && existing !== remoteStream) {
          for (const t of remoteStream.getTracks()) {
            if (!existing.getTracks().some((x) => x.id === t.id)) {
              existing.addTrack(t);
            }
          }
          remoteStream = existing;
        } else {
          remoteStreamsRef.current.set(socketId, remoteStream);
        }
      }

      callbacksRef.current.onRemoteStream?.(socketId, remoteStream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        emit('ice-candidate', {
          targetSocketId: socketId,
          candidate: event.candidate
        });
      }
    };

    pc.onnegotiationneeded = () => {
      handleNegotiationNeeded(socketId);
    };

    const handleState = (state) => {
      callbacksRef.current.onConnectionStateChange?.(socketId, state);
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      handleState(state);

      if (state === 'failed') {
        closePeerConnection(socketId);
      } else if (state === 'disconnected') {
        clearDisconnectTimer(socketId);
        const timer = setTimeout(() => {
          disconnectTimersRef.current.delete(socketId);
          const current = peersRef.current.get(socketId);
          if (current && current.iceConnectionState === 'disconnected') {
            closePeerConnection(socketId);
          }
        }, 5000);
        disconnectTimersRef.current.set(socketId, timer);
      } else if (state === 'connected' || state === 'completed') {
        clearDisconnectTimer(socketId);
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      handleState(state);

      if (state === 'failed' || state === 'closed') {
        closePeerConnection(socketId);
      }
    };

    return pc;
  }, [emit, handleNegotiationNeeded, closePeerConnection, clearDisconnectTimer]);

  // ---------------------------------------------------------------------------
  // Инициация соединений
  // ---------------------------------------------------------------------------

  const createPeerConnection = useCallback(async (socketId, isInitiator) => {
    if (!socketRef.current) return;

    let pc = peersRef.current.get(socketId);
    if (!pc) {
      pc = setupPeerConnection(socketId, { polite: !isInitiator });
    }

    if (!isInitiator) return;

    if (pc.signalingState !== 'stable') {
      renegotiatePendingRef.current.set(socketId, true);
      return;
    }

    try {
      await handleNegotiationNeeded(socketId);
    } catch (err) {
      console.error('[useWebRTC] createPeerConnection error:', err);
      closePeerConnection(socketId);
    }
  }, [setupPeerConnection, closePeerConnection, handleNegotiationNeeded]);

  // ---------------------------------------------------------------------------
  // Обработка входящих сигналов
  // ---------------------------------------------------------------------------

  const flushPendingCandidates = useCallback(async (socketId, pc) => {
    const pending = pendingCandidatesRef.current.get(socketId);
    if (!pending || pending.length === 0) return;

    pendingCandidatesRef.current.delete(socketId);

    const failed = [];
    for (const candidate of pending) {
      if (!candidate || !candidate.candidate) continue;
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        if (err.name === 'OperationError' || err.name === 'InvalidStateError') {
          failed.push(candidate);
        } else {
          console.error('[useWebRTC] addIceCandidate (buffered) error:', err);
        }
      }
    }

    if (failed.length > 0) {
      const existing = pendingCandidatesRef.current.get(socketId) || [];
      pendingCandidatesRef.current.set(socketId, [...existing, ...failed]);
    }
  }, []);

  const handleOffer = useCallback(async (fromSocketId, sdp) => {
    let pc = peersRef.current.get(fromSocketId);
    if (!pc) {
      const myId = socketRef.current?.id || '';
      const polite = myId > fromSocketId;
      pc = setupPeerConnection(fromSocketId, { polite });
    }

    try {
      const inFlight = makingOfferRef.current.get(fromSocketId);
      const makingOffer = Boolean(inFlight);
      const offerCollision = makingOffer || pc.signalingState !== 'stable';

      if (offerCollision && !pc._polite) {
        return;
      }

      if (offerCollision && pc._polite) {
        if (inFlight) {
          try { await inFlight; } catch (_) { /* ignore */ }
        }
        if (pc.signalingState !== 'stable') {
          try {
            await pc.setLocalDescription({ type: 'rollback' });
          } catch (err) {
            console.warn('[useWebRTC] rollback failed:', err);
          }
        }
      }

      if (pc.signalingState !== 'stable') {
        console.warn('[useWebRTC] skip offer: signalingState =', pc.signalingState);
        return;
      }

      await pc.setRemoteDescription(sdp);
      await flushPendingCandidates(fromSocketId, pc);

      if (pc.signalingState !== 'have-remote-offer') return;

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      emit('answer', { targetSocketId: fromSocketId, sdp: answer });
    } catch (err) {
      if (err.name === 'InvalidAccessError') {
        const myId = socketRef.current?.id || '';
        closePeerConnection(fromSocketId, { notify: false });
        createPeerConnection(fromSocketId, myId < fromSocketId);
        return;
      }
      console.error('[useWebRTC] handleOffer error:', err);
    }
  }, [setupPeerConnection, flushPendingCandidates, emit, closePeerConnection, createPeerConnection]);

  const handleAnswer = useCallback(async (fromSocketId, sdp) => {
    const pc = peersRef.current.get(fromSocketId);
    if (!pc) return;

    if (pc.signalingState !== 'have-local-offer') {
      return;
    }

    try {
      await pc.setRemoteDescription(sdp);
      await flushPendingCandidates(fromSocketId, pc);

      if (renegotiatePendingRef.current.get(fromSocketId) && pc.signalingState === 'stable') {
        renegotiatePendingRef.current.delete(fromSocketId);
        handleNegotiationNeeded(fromSocketId);
      }
    } catch (err) {
      console.error('[useWebRTC] handleAnswer error:', err);
    }
  }, [flushPendingCandidates, handleNegotiationNeeded]);

  const handleIceCandidate = useCallback(async (fromSocketId, candidate) => {
    if (!candidate || !candidate.candidate) return;

    const pc = peersRef.current.get(fromSocketId);

    const notReady =
      !pc ||
      !pc.remoteDescription ||
      !pc.remoteDescription.type ||
      pc.signalingState !== 'stable';

    if (notReady) {
      const list = pendingCandidatesRef.current.get(fromSocketId) || [];
      list.push(candidate);
      pendingCandidatesRef.current.set(fromSocketId, list);
      return;
    }

    try {
      await pc.addIceCandidate(candidate);
    } catch (err) {
      if (err.name === 'OperationError' || err.name === 'InvalidStateError') {
        const list = pendingCandidatesRef.current.get(fromSocketId) || [];
        list.push(candidate);
        pendingCandidatesRef.current.set(fromSocketId, list);
      } else {
        console.error('[useWebRTC] addIceCandidate error:', err);
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Закрытие
  // ---------------------------------------------------------------------------

  const closeAllConnections = useCallback(() => {
    const ids = Array.from(peersRef.current.keys());
    ids.forEach((socketId) => {
      closePeerConnection(socketId, { notify: true });
    });

    peersRef.current.clear();
    pendingCandidatesRef.current.clear();
    makingOfferRef.current.clear();
    renegotiatePendingRef.current.clear();
    pendingInitiatorsRef.current.clear();
    remoteStreamsRef.current.clear();

    disconnectTimersRef.current.forEach((timer) => clearTimeout(timer));
    disconnectTimersRef.current.clear();

    setPeers(new Map());
  }, [closePeerConnection]);

  // ---------------------------------------------------------------------------
  // Отложенные инициации
  // ---------------------------------------------------------------------------

  const initiatePendingConnections = useCallback(() => {
    if (pendingInitiatorsRef.current.size === 0) return;
    const targets = Array.from(pendingInitiatorsRef.current);
    pendingInitiatorsRef.current.clear();
    targets.forEach((socketId) => {
      if (!peersRef.current.has(socketId)) {
        createPeerConnection(socketId, true);
      }
    });
  }, [createPeerConnection]);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  /**
   * Реакция на появление/смену локального потока.
   *
   * Ключевая логика mesh: после появления треков у impolite-пира запускаем
   * renegotiation. Polite-пир только помечает renegotiatePending — он дождётся
   * offer'а от impolite и обновит SDP в answer'е. Это убирает каскад
   * одновременных offer'ов при появлении localStream у всех участников.
   */
  useEffect(() => {
    initiatePendingConnections();

    if (!localStream) return;

    peersRef.current.forEach(async (pc, socketId) => {
      if (!pc._streamUpdateHandler) return;

      const before = snapshotPcState(pc);

      try {
        await pc._streamUpdateHandler();
      } catch (err) {
        console.error('[useWebRTC] streamUpdateHandler error:', err);
        return;
      }

      const after = snapshotPcState(pc);
      if (before === after) return;

      const myId = socketRef.current?.id || '';
      const weAreImpolite = myId < socketId;

      if (pc.signalingState === 'stable') {
        if (weAreImpolite) {
          handleNegotiationNeeded(socketId);
        } else {
          // Polite: ждём offer от impolite. Если impolite не инициирует
          // (например, у него не было треков и снапшот не изменился),
          // negotiationneeded всё равно выстрелит на его стороне, потому что
          // SDP у него тоже изменился. Здесь мы просто помечаем.
          renegotiatePendingRef.current.set(socketId, true);
        }
      } else {
        renegotiatePendingRef.current.set(socketId, true);
      }
    });
  }, [localStream, initiatePendingConnections, handleNegotiationNeeded]);

  // Socket-события WebRTC
  useEffect(() => {
    if (!socket) return undefined;

    const onOffer = ({ from, sdp }) => handleOffer(from, sdp);
    const onAnswer = ({ from, sdp }) => handleAnswer(from, sdp);
    const onIce = ({ from, candidate }) => handleIceCandidate(from, candidate);

    socket.on('offer', onOffer);
    socket.on('answer', onAnswer);
    socket.on('ice-candidate', onIce);

    return () => {
      socket.off('offer', onOffer);
      socket.off('answer', onAnswer);
      socket.off('ice-candidate', onIce);
    };
  }, [socket, handleOffer, handleAnswer, handleIceCandidate]);

  // Socket-события комнаты
  useEffect(() => {
    if (!socket) return undefined;

    const onRoomJoined = ({ participants = [] }) => {
      participants.forEach((p) => {
        const peerId = p.socketId;
        if (peerId === socket.id) return;
        if (peersRef.current.has(peerId)) return;

        if (socket.id < peerId) {
          pendingInitiatorsRef.current.add(peerId);
        } else {
          setupPeerConnection(peerId, { polite: true });
        }
      });
      initiatePendingConnections();
    };

    const onUserJoined = ({ socketId }) => {
      if (socketId === socket.id) return;
      if (peersRef.current.has(socketId)) return;

      const shouldInitiate = socket.id < socketId;
      if (shouldInitiate) {
        pendingInitiatorsRef.current.add(socketId);
        initiatePendingConnections();
      } else {
        setupPeerConnection(socketId, { polite: true });
      }
    };

    const onUserLeft = ({ socketId }) => {
      closePeerConnection(socketId);
    };

    socket.on('room-joined', onRoomJoined);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);

    return () => {
      socket.off('room-joined', onRoomJoined);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
    };
  }, [
    socket,
    createPeerConnection,
    closePeerConnection,
    initiatePendingConnections,
    setupPeerConnection
  ]);

  // Cleanup при unmount
  useEffect(() => {
    return () => {
      const ids = Array.from(peersRef.current.keys());
      ids.forEach((socketId) => {
        const pc = peersRef.current.get(socketId);
        if (pc) {
          try { pc.close(); } catch (_) { /* ignore */ }
        }
      });
      peersRef.current.clear();
      pendingCandidatesRef.current.clear();
      makingOfferRef.current.clear();
      renegotiatePendingRef.current.clear();
      pendingInitiatorsRef.current.clear();
      remoteStreamsRef.current.clear();
      disconnectTimersRef.current.forEach((t) => clearTimeout(t));
      disconnectTimersRef.current.clear();
    };
  }, []);

  return {
    peers,
    createPeerConnection,
    closePeerConnection,
    closeAllConnections
  };
}

export default useWebRTC;