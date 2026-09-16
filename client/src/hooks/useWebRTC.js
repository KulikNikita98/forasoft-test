import { useEffect, useRef, useState, useCallback } from 'react';
import config from '../config/index.js';

/**
 * useWebRTC — управление RTCPeerConnection для mesh-топологии (TDD задача 14).
 *
 * Perfect negotiation с фиксированными transceiver'ами:
 * - при создании соединения резервируем transceiver'ы (audio, video) в
 *   фиксированном порядке → одинаковый порядок m-lines у всех пиров;
 * - onnegotiationneeded сам отправляет offer (в т.ч. при позднем включении
 *   камеры через replaceTrack) — инициатором становится та сторона, что
 *   реально изменила медиа;
 * - glare разруливается вежливостью: при коллизии offer'ов невежливый пир
 *   (меньший socket.id) игнорирует чужой offer, вежливый откатывается;
 * - устройства могут быть выключены при входе (localStream=null) — transceiver
 *   поднимет negotiation и пустое соединение установится, готовое принимать;
 * - ICE-кандидаты буферизуются до установки remoteDescription;
 * - удалённые треки агрегируются в один стабильный MediaStream на пир.
 *
 * @param {object} params
 * @param {import('socket.io-client').Socket} params.socket
 * @param {MediaStream} params.localStream
 * @param {(socketId: string, stream: MediaStream) => void} params.onRemoteStream
 * @param {(socketId: string) => void} params.onPeerLeft
 * @param {(socketId: string, state: string) => void} [params.onConnectionStateChange]
 * @returns {{
 *   peers: Map<string, RTCPeerConnection>,
 *   createPeerConnection: (socketId: string) => Promise<void>,
 *   closePeerConnection: (socketId: string) => void,
 *   closeAllConnections: () => void
 * }}
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
  socketRef.current = socket;

  const localStreamRef = useRef(localStream);
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // ICE-кандидаты, пришедшие до установки remoteDescription
  const pendingCandidatesRef = useRef(new Map());
  // Таймеры отложенного закрытия при disconnected
  const disconnectTimersRef = useRef(new Map());
  // socketId -> стабильный MediaStream с удалёнными треками пира
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

    pendingCandidatesRef.current.delete(socketId);
    remoteStreamsRef.current.delete(socketId);
    clearDisconnectTimer(socketId);

    if (!pc) return;

    delete pc._streamUpdateHandler;
    pc.onnegotiationneeded = null;
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.oniceconnectionstatechange = null;
    pc.onconnectionstatechange = null;
    try { pc.close(); } catch (_) { /* ignore */ }

    peersRef.current.delete(socketId);
    setPeers(new Map(peersRef.current));

    if (notify && callbacksRef.current.onPeerLeft) {
      callbacksRef.current.onPeerLeft(socketId);
    }
  }, [clearDisconnectTimer]);

  const flushPendingCandidates = useCallback(async (socketId, pc) => {
    const pending = pendingCandidatesRef.current.get(socketId);
    if (!pending || pending.length === 0) return;
    pendingCandidatesRef.current.delete(socketId);

    for (const candidate of pending) {
      if (!candidate || !candidate.candidate) continue;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[useWebRTC] addIceCandidate (buffered) error:', err);
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Создание RTCPeerConnection (задача 14.2, 14.5)
  // ---------------------------------------------------------------------------

  const setupPeerConnection = useCallback((socketId) => {
    const existing = peersRef.current.get(socketId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: config.webrtc.iceServers });
    // Perfect-negotiation-флаги для защиты от glare при renegotiation.
    // Вежливость: вежлив тот, у кого socket.id больше.
    pc._polite = (socketRef.current?.id || '') > socketId;
    pc._makingOffer = false;
    peersRef.current.set(socketId, pc);
    setPeers(new Map(peersRef.current));

    // Резервируем transceiver'ы в фиксированном порядке (audio, video), сразу
    // sendrecv. Это даёт: (1) одинаковый порядок m-lines у всех пиров, (2)
    // onnegotiationneeded сработает даже без треков (вход с выключенными
    // устройствами) — пустое соединение поднимется и будет готово принимать.
    const stream = localStreamRef.current;
    const audioTrack = stream?.getAudioTracks()[0] || null;
    const videoTrack = stream?.getVideoTracks()[0] || null;

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

    // Навешивает актуальные локальные треки на transceiver'ы. Трогаем sender
    // ТОЛЬКО при реальной смене трека — иначе replaceTrack спровоцирует лишний
    // onnegotiationneeded и получится цикл renegotiation.
    pc._streamUpdateHandler = async () => {
      const currentStream = localStreamRef.current;
      if (!currentStream) return;

      const bind = async (transceiver, track) => {
        if (!transceiver || transceiver.stopped || !track) return;
        if (transceiver.sender.track === track) return; // уже привязан
        try {
          await transceiver.sender.replaceTrack(track);
          transceiver.sender.setStreams(currentStream);
        } catch (err) {
          console.error('[useWebRTC] replaceTrack error:', err);
        }
      };

      await bind(audioTransceiver, currentStream.getAudioTracks()[0] || null);
      await bind(videoTransceiver, currentStream.getVideoTracks()[0] || null);
    };

    // ontrack: собираем удалённые треки в один стабильный MediaStream на пир.
    // event.streams ненадёжен (может быть пустым), поэтому агрегируем сами —
    // так audio и video всегда в одном потоке и stream.id не меняется.
    pc.ontrack = (event) => {
      const { track } = event;
      if (!track) return;

      let remoteStream = remoteStreamsRef.current.get(socketId);
      if (!remoteStream) {
        remoteStream = new MediaStream();
        remoteStreamsRef.current.set(socketId, remoteStream);
      }
      if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
        remoteStream.addTrack(track);
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

    // onnegotiationneeded: срабатывает при addTrack (включение камеры/микрофона
    // после установки соединения). Инициатором renegotiation становится тот, у
    // кого добавился трек. Glare защищаем через perfect-negotiation-флаги:
    // невежливый (меньший socket.id) игнорирует чужой offer при коллизии.
    pc.onnegotiationneeded = async () => {
      try {
        pc._makingOffer = true;
        await pc.setLocalDescription();
        emit('offer', { targetSocketId: socketId, sdp: pc.localDescription });
      } catch (err) {
        console.error('[useWebRTC] negotiationneeded error:', err);
      } finally {
        pc._makingOffer = false;
      }
    };

    const handleState = (state) => {
      callbacksRef.current.onConnectionStateChange?.(socketId, state);
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      handleState(state);

      if (state === 'failed') {
        // Пробуем восстановить ICE вместо закрытия — соединение может ожить
        try { pc.restartIce(); } catch (_) { /* ignore */ }
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
      // Только closed закрываем окончательно; failed пробуем восстановить выше
      if (state === 'closed') {
        closePeerConnection(socketId);
      }
    };

    return pc;
  }, [emit, closePeerConnection, clearDisconnectTimer]);

  // ---------------------------------------------------------------------------
  // createPeerConnection(socketId, isInitiator) (задача 14.2, 14.3)
  // ---------------------------------------------------------------------------

  const createPeerConnection = useCallback(async (socketId) => {
    if (!socketRef.current) return;
    // Просто создаём соединение. addTransceiver в setupPeerConnection поднимет
    // onnegotiationneeded, и инициатор сам отправит offer — двойного offer нет.
    // Роль вежливости и glare разруливаются в handleOffer.
    if (!peersRef.current.has(socketId)) {
      setupPeerConnection(socketId);
    }
  }, [setupPeerConnection]);

  // ---------------------------------------------------------------------------
  // Signaling handlers (задача 14.4)
  // ---------------------------------------------------------------------------

  const handleOffer = useCallback(async (fromSocketId, sdp) => {
    let pc = peersRef.current.get(fromSocketId);
    if (!pc) pc = setupPeerConnection(fromSocketId);

    try {
      // Glare: offer пришёл, пока мы сами делаем offer или не в stable.
      const collision = pc._makingOffer || pc.signalingState !== 'stable';
      const ignoreOffer = !pc._polite && collision;

      if (ignoreOffer) {
        // Невежливый пир игнорирует конфликтующий offer — победит его offer
        return;
      }

      // Вежливый пир при коллизии откатывается: setRemoteDescription(offer)
      // из не-stable делает implicit rollback.
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushPendingCandidates(fromSocketId, pc);
      await pc.setLocalDescription();
      emit('answer', { targetSocketId: fromSocketId, sdp: pc.localDescription });
    } catch (err) {
      console.error('[useWebRTC] handleOffer error:', err);
    }
  }, [setupPeerConnection, flushPendingCandidates, emit]);

  const handleAnswer = useCallback(async (fromSocketId, sdp) => {
    const pc = peersRef.current.get(fromSocketId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushPendingCandidates(fromSocketId, pc);
    } catch (err) {
      console.error('[useWebRTC] handleAnswer error:', err);
    }
  }, [flushPendingCandidates]);

  const handleIceCandidate = useCallback(async (fromSocketId, candidate) => {
    if (!candidate || !candidate.candidate) return;

    const pc = peersRef.current.get(fromSocketId);

    // До remoteDescription addIceCandidate падает — буферизуем
    if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
      const list = pendingCandidatesRef.current.get(fromSocketId) || [];
      list.push(candidate);
      pendingCandidatesRef.current.set(fromSocketId, list);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('[useWebRTC] addIceCandidate error:', err);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Закрытие (задача 14.7)
  // ---------------------------------------------------------------------------

  const closeAllConnections = useCallback(() => {
    const ids = Array.from(peersRef.current.keys());
    ids.forEach((socketId) => closePeerConnection(socketId, { notify: true }));

    peersRef.current.clear();
    pendingCandidatesRef.current.clear();
    remoteStreamsRef.current.clear();
    disconnectTimersRef.current.forEach((timer) => clearTimeout(timer));
    disconnectTimersRef.current.clear();

    setPeers(new Map());
  }, [closePeerConnection]);

  // ---------------------------------------------------------------------------
  // Эффект: локальный поток появился/сменился — навешиваем треки на transceiver'ы
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!localStream) return;

    peersRef.current.forEach((pc) => {
      if (!pc._streamUpdateHandler) return;
      // replaceTrack на пустой transceiver.sender сам поднимет
      // onnegotiationneeded → offer уйдёт корректно у той стороны, что включила
      // камеру. Ручной offer не нужен, двойного offer нет.
      pc._streamUpdateHandler().catch((err) => {
        console.error('[useWebRTC] streamUpdateHandler error:', err);
      });
    });
  }, [localStream]);

  // ---------------------------------------------------------------------------
  // Signaling подписка (задача 14.1, 14.4)
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Room события: кто инициатор (задача 14.3, правило против glare)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!socket) return undefined;

    // Входим в комнату: создаём соединение с каждым существующим участником.
    // Кто шлёт offer — решает onnegotiationneeded (сработает при addTransceiver),
    // glare разруливается в handleOffer по вежливости (больший socket.id вежлив).
    const onRoomJoined = ({ participants = [] }) => {
      participants.forEach((p) => {
        if (p.socketId === socket.id) return;
        if (peersRef.current.has(p.socketId)) return;
        createPeerConnection(p.socketId);
      });
    };

    // Пришёл новый участник — создаём соединение и с ним.
    const onUserJoined = ({ socketId: newId }) => {
      if (newId === socket.id) return;
      if (peersRef.current.has(newId)) return;
      createPeerConnection(newId);
    };

    const onUserLeft = ({ socketId: leftId }) => {
      closePeerConnection(leftId);
    };

    socket.on('room-joined', onRoomJoined);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);

    return () => {
      socket.off('room-joined', onRoomJoined);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
    };
  }, [socket, createPeerConnection, closePeerConnection]);

  // ---------------------------------------------------------------------------
  // Cleanup при unmount (задача 14.8)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    return () => {
      peersRef.current.forEach((pc) => {
        try { pc.close(); } catch (_) { /* ignore */ }
      });
      peersRef.current.clear();
      pendingCandidatesRef.current.clear();
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
