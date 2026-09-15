import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import RoomManager from '../../src/domain/RoomManager.js';
import SignalingHandler from '../../src/infrastructure/SignalingHandler.js';

// Заглушка логгера, чтобы не засорять вывод тестов
const silentLogger = { info: () => {}, error: () => {}, warn: () => {} };

const VALID_ROOM = '550e8400-e29b-41d4-a716-446655440000';

describe('SignalingHandler (join/leave integration)', () => {
  let httpServer;
  let io;
  let roomManager;
  let port;
  const clients = [];

  beforeEach(async () => {
    httpServer = createServer();
    io = new Server(httpServer);
    roomManager = new RoomManager();
    const handler = new SignalingHandler(io, roomManager, silentLogger);

    io.on('connection', (socket) => handler.register(socket));

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        port = httpServer.address().port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    clients.forEach((c) => c.close());
    clients.length = 0;
    io.close();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  function connect() {
    const client = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true
    });
    clients.push(client);
    return client;
  }

  function joinRoom(client, roomId, userName) {
    return new Promise((resolve) => {
      client.emit('join-room', { roomId, userName }, resolve);
    });
  }

  it('should acknowledge successful join with participants and history', async () => {
    const client = connect();
    const ack = await joinRoom(client, VALID_ROOM, 'Alice');

    expect(ack.success).toBe(true);
    expect(ack.participants).toHaveLength(1);
    expect(ack.participants[0].userName).toBe('Alice');
    expect(ack.participants[0].mediaState).toEqual({ audio: true, video: true });
    // Первый вошедший не видит системное сообщение о собственном входе
    expect(ack.chatHistory).toEqual([]);
  });

  it('should reject join with invalid name', async () => {
    const client = connect();
    const ack = await joinRoom(client, VALID_ROOM, '<script>alert(1)</script>');

    expect(ack.success).toBe(false);
    expect(ack.error).toBe('invalid-name');
  });

  it('should reject join with invalid roomId', async () => {
    const client = connect();
    const ack = await joinRoom(client, 'not-a-uuid', 'Alice');

    expect(ack.success).toBe(false);
    expect(ack.error).toBe('invalid-room');
  });

  it('should reject 5th participant with room-full', async () => {
    await joinRoom(connect(), VALID_ROOM, 'A');
    await joinRoom(connect(), VALID_ROOM, 'B');
    await joinRoom(connect(), VALID_ROOM, 'C');
    await joinRoom(connect(), VALID_ROOM, 'D');
    const ack = await joinRoom(connect(), VALID_ROOM, 'E');

    expect(ack.success).toBe(false);
    expect(ack.error).toBe('room-full');
  });

  it('should broadcast user-joined to existing participants', async () => {
    const alice = connect();
    await joinRoom(alice, VALID_ROOM, 'Alice');

    const userJoined = new Promise((resolve) => {
      alice.on('user-joined', resolve);
    });

    const bob = connect();
    await joinRoom(bob, VALID_ROOM, 'Bob');

    const payload = await userJoined;
    expect(payload.userName).toBe('Bob');
    expect(payload.socketId).toBeDefined();
  });

  it('should broadcast system-message on join', async () => {
    const alice = connect();
    await joinRoom(alice, VALID_ROOM, 'Alice');

    const systemMsg = new Promise((resolve) => {
      alice.on('system-message', resolve);
    });

    const bob = connect();
    await joinRoom(bob, VALID_ROOM, 'Bob');

    const payload = await systemMsg;
    expect(payload.type).toBe('system');
    expect(payload.text).toContain('Bob');
    expect(payload.text).toContain('присоединился');
  });

  it('should broadcast user-left on leave-room', async () => {
    const alice = connect();
    await joinRoom(alice, VALID_ROOM, 'Alice');
    const bob = connect();
    await joinRoom(bob, VALID_ROOM, 'Bob');

    const userLeft = new Promise((resolve) => {
      alice.on('user-left', resolve);
    });

    bob.emit('leave-room', { roomId: VALID_ROOM });

    const payload = await userLeft;
    expect(payload.userName).toBe('Bob');
  });

  it('should broadcast user-left on disconnect (disconnecting)', async () => {
    const alice = connect();
    await joinRoom(alice, VALID_ROOM, 'Alice');
    const bob = connect();
    await joinRoom(bob, VALID_ROOM, 'Bob');

    const userLeft = new Promise((resolve) => {
      alice.on('user-left', resolve);
    });

    bob.close();

    const payload = await userLeft;
    expect(payload.userName).toBe('Bob');
  });

  it('should delete room when last participant leaves', async () => {
    const alice = connect();
    await joinRoom(alice, VALID_ROOM, 'Alice');

    expect(roomManager.getRoom(VALID_ROOM)).toBeDefined();

    alice.emit('leave-room', { roomId: VALID_ROOM });

    // Дать серверу обработать событие
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(roomManager.getRoom(VALID_ROOM)).toBeUndefined();
  });

  it('should provide chat history to late joiners', async () => {
    const alice = connect();
    await joinRoom(alice, VALID_ROOM, 'Alice');

    // Bob joins -> system message added to history
    const bob = connect();
    await joinRoom(bob, VALID_ROOM, 'Bob');

    // Give server time to store system message
    await new Promise((resolve) => setTimeout(resolve, 50));

    const charlie = connect();
    const ack = await joinRoom(charlie, VALID_ROOM, 'Charlie');

    // История содержит системные сообщения о входах Bob и Charlie(не включая свой)
    expect(ack.chatHistory.length).toBeGreaterThan(0);
    expect(ack.chatHistory.some((m) => m.type === 'system')).toBe(true);
  });
});
