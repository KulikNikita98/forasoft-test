import { useEffect, useRef, useState } from 'react';

// Google STUN серверы для NAT traversal
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

/**
 * useWebRTC — управление RTCPeerConnection для mesh-топологии.
 * Создает P2P соединение с каждым участником комнаты.
 *
 * @param {object} params
 * @param {import('socket.io-client').Socket} params.socket
 * @param {MediaStream} params.localStream
 * @param {(socketId: string, stream: MediaStream) => void} params.onRemoteStream
 * @param {(socketId: string) => void} params.onPeerLeft
 * @returns {{
 *   peers: Map<string, RTCPeerConnection>,
 *   createPeerConnection: (socketId: string, isInitiator: boolean) => Promise<void>,
 *   closePeerConnection: (socketId: string) => void,
 *   closeAllConnections: () => void
 * }}
 */
export function useWebRTC({ socket, localStream, onRemoteStream, onPeerLeft }) {
  const peersRef = useRef(new Map());
  const [peers, setPeers] = useState(new Map());

  const createPeerConnection = async (socketId, isInitiator) => {
    if (!socket || !localStream) return;

    // Создаем RTCPeerConnection с STUN конфигурацией
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(socketId, pc);
    setPeers(new Map(peersRef.current));

    // Добавляем локальные треки в соединение
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    // Обработка входящих remote треков
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream && onRemoteStream) {
        onRemoteStream(socketId, remoteStream);
      }
    };

    // Отправка ICE candidates через Socket.io
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          targetSocketId: socketId,
          candidate: event.candidate
        });
      }
    };

    // Мониторинг состояния соединения
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        closePeerConnection(socketId);
      }
    };

    // Если мы инициатор — создаем и отправляем offer
    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', {
          targetSocketId: socketId,
          sdp: offer
        });
      } catch (err) {
        console.error('Error creating offer:', err);
        closePeerConnection(socketId);
      }
    }
  };

  const handleOffer = async (fromSocketId, sdp) => {
    const pc = peersRef.current.get(fromSocketId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', {
        targetSocketId: fromSocketId,
        sdp: answer
      });
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  };

  const handleAnswer = async (fromSocketId, sdp) => {
    const pc = peersRef.current.get(fromSocketId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  };

  const handleIceCandidate = async (fromSocketId, candidate) => {
    const pc = peersRef.current.get(fromSocketId);
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  };

  const closePeerConnection = (socketId) => {
    const pc = peersRef.current.get(socketId);
    if (pc) {
      pc.close();
      peersRef.current.delete(socketId);
      setPeers(new Map(peersRef.current));

      if (onPeerLeft) {
        onPeerLeft(socketId);
      }
    }
  };

  const closeAllConnections = () => {
    peersRef.current.forEach((pc) => {
      pc.close();
    });
    peersRef.current.clear();
    setPeers(new Map());
  };

  // Слушаем WebRTC signaling события от сервера
  useEffect(() => {
    if (!socket) return undefined;

    socket.on('offer', ({ from, sdp }) => {
      handleOffer(from, sdp);
    });

    socket.on('answer', ({ from, sdp }) => {
      handleAnswer(from, sdp);
    });

    socket.on('ice-candidate', ({ fromSocketId, candidate }) => {
      handleIceCandidate(fromSocketId, candidate);
    });

    return () => {
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
    };
  }, [socket]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      closeAllConnections();
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
