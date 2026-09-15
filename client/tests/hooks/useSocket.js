import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Мок socket.io-client: создаём управляемый fake-socket
const handlers = {};
const ioHandlers = {};
const fakeSocket = {
  on: vi.fn((event, cb) => {
    handlers[event] = cb;
  }),
  io: {
    on: vi.fn((event, cb) => {
      ioHandlers[event] = cb;
    }),
    _reconnectionAttempts: 0
  },
  removeAllListeners: vi.fn(),
  disconnect: vi.fn()
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => fakeSocket)
}));

import { io } from 'socket.io-client';
import { useSocket } from '../../src/hooks/useSocket.js';

// Хелперы для эмуляции серверных событий
function emit(event, payload) {
  act(() => {
    handlers[event]?.(payload);
  });
}

describe('useSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    Object.keys(ioHandlers).forEach((k) => delete ioHandlers[k]);
    fakeSocket.io._reconnectionAttempts = 0;
  });

  it('does not connect when disabled', () => {
    renderHook(() => useSocket({ roomId: 'r', userName: 'A', enabled: false }));
    expect(io).not.toHaveBeenCalled();
  });

  it('does not connect without roomId or userName', () => {
    renderHook(() => useSocket({ roomId: '', userName: '', enabled: true }));
    expect(io).not.toHaveBeenCalled();
  });

  it('connects with roomId and userName in query', () => {
    renderHook(() => useSocket({ roomId: 'room-1', userName: 'Alice' }));
    expect(io).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { roomId: 'room-1', userName: 'Alice' }
      })
    );
  });

  it('sets status connected on connect event', async () => {
    const { result } = renderHook(() => useSocket({ roomId: 'r', userName: 'A' }));
    emit('connect');
    await waitFor(() => expect(result.current.status).toBe('connected'));
  });

  it('captures room-joined payload', async () => {
    const { result } = renderHook(() => useSocket({ roomId: 'r', userName: 'A' }));
    emit('room-joined', {
      participants: [{ socketId: 's1', userName: 'Bob' }],
      chatHistory: [{ message: 'hi' }]
    });
    await waitFor(() => {
      expect(result.current.roomState.participants).toHaveLength(1);
      expect(result.current.roomState.chatHistory).toHaveLength(1);
    });
  });

  it('captures server error (room-full / validation)', async () => {
    const { result } = renderHook(() => useSocket({ roomId: 'r', userName: 'A' }));
    emit('error', { type: 'room-full' });
    await waitFor(() => {
      expect(result.current.status).toBe('error');
      expect(result.current.error.type).toBe('room-full');
    });
  });

  it('disconnects on unmount', () => {
    const { unmount } = renderHook(() => useSocket({ roomId: 'r', userName: 'A' }));
    unmount();
    expect(fakeSocket.disconnect).toHaveBeenCalled();
  });
});
