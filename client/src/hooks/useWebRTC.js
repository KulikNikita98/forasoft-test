import { useEffect, useRef, useState } from 'react';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

/**
 * useWebRTC — управление RTCPeerConnection для mesh-топологии.
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

  const localStreamRef = useRef(localStream);
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const pendingCandidatesRef = useRef(new Map());
  const pendingInitiatorsRef = useRef([]);

  const setupPeerConnection = (socketId) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(socketId, pc);
    setPeers(new Map(peersRef.current));

    const stream = localStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream && onRemoteStream) {
        onRemoteStream(socketId, remoteStream);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          targetSocketId: socketId,
          candidate: event.candidate
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        closePeerConnection(socketId);
      }
    };

    return pc;
  };

  const createPeerConnection = async (socketId, isInitiator) => {
    if (!socket) return;

    let pc = peersRef.current.get(socketId);
    if (!pc) {
      pc = setupPeerConnection(socketId);
    }

    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('offer', { targetSocketId: socketId, sdp: offer });
      } catch (err) {
        console.error('Error creating offer:', err);
        closePeerConnection(socketId);
      }
    }
  };

  const flushPendingCandidates = async (socketId, pc) => {
    const pending = pendingCandidatesRef.current.get(socketId);
    if (!pending) return;

    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Error adding buffered ICE candidate:', err);
      }
    }
    pendingCandidatesRef.current.delete(socketId);
  };

  const handleOffer = async (fromSocketId, sdp) => {
    let pc = peersRef.current.get(fromSocketId);
    if (!pc) {
      pc = setupPeerConnection(fromSocketId);
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushPendingCandidates(fromSocketId, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('answer', { targetSocketId: fromSocketId, sdp: answer });
    } catch (err) {
      console.error('Error handling offer:', err);
    }
  };

  const handleAnswer = async (fromSocketId, sdp) => {
    const pc = peersRef.current.get(fromSocketId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushPendingCandidates(fromSocketId, pc);
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  };

  const handleIceCandidate = async (fromSocketId, candidate) => {
    const pc = peersRef.current.get(fromSocketId);

    if (!pc || !pc.remoteDescription) {
      const list = pendingCandidatesRef.current.get(fromSocketId) || [];
      list.push(candidate);
      pendingCandidatesRef.current.set(fromSocketId, list);
      return;
    }

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
      pendingCandidatesRef.current.delete(socketId);
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
    pendingCandidatesRef.current.clear();
    setPeers(new Map());
  };

  const initiatePendingConnections = () => {
    if (!localStreamRef.current || pendingInitiatorsRef.current.length === 0) return;

    const targets = pendingInitiatorsRef.current;
    pendingInitiatorsRef.current = [];
    targets.forEach((socketId) => {
      createPeerConnection(socketId, true);
    });
  };

  useEffect(() => {
    if (localStream) {
      initiatePendingConnections();
    }
  }, [localStream]);

  useEffect(() => {
    if (!socket) return undefined;

    const onOffer = ({ from, sdp }) => handleOffer(from, sdp);
    const onAnswer = ({ from, sdp }) => handleAnswer(from, sdp);
    const onIce = ({ fromSocketId, candidate }) => handleIceCandidate(fromSocketId, candidate);

    socket.on('offer', onOffer);
    socket.on('answer', onAnswer);
    socket.on('ice-candidate', onIce);

    return () => {
      socket.off('offer', onOffer);
      socket.off('answer', onAnswer);
      socket.off('ice-candidate', onIce);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return undefined;

    const onRoomJoined = ({ participants = [] }) => {
      pendingInitiatorsRef.current = participants.map((p) => p.socketId);
      initiatePendingConnections();
    };

    const onUserLeft = ({ socketId }) => {
      closePeerConnection(socketId);
    };

    socket.on('room-joined', onRoomJoined);
    socket.on('user-left', onUserLeft);

    return () => {
      socket.off('room-joined', onRoomJoined);
      socket.off('user-left', onUserLeft);
    };
  }, [socket]);

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
