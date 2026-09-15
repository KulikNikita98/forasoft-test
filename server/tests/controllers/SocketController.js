import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import RoomService from '../../src/services/RoomService.js';
import SocketController from '../../src/controllers/SocketController.js';

const silentLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };
const VALID_ROOM = '550e8400-e29b-41d4-a716-446655440000';

describe('SocketController (integration)', () => {
  let httpServer;
  let io;
  let roomService;
  let port;
  const clients = [];

  beforeEach(async () => {
    httpServer = createServer();
    io = new Server(httpServer);
    roomService = new RoomService();
    const controller = new SocketController(io, roomService, silentLogger);

    io.on('connection', (socket) => controller.handleConnection(socket));

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

  function connect(roomId, userName) {
    const client = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      query: { roomId, userName }
    });
    clients.push(client);
    return client;
  }

  function waitFor(client, event) {
    return new Promise((resolve) => client.on(event, resolve));
  }

  it('should emit room-joined on successful connection', async () => {
    const alice = connect(VALID_ROOM, 'Alice');
    const payload = await waitFor(alice, 'room-joined');

    expect(payload.participants).toEqual([]);
    expect(payload.chatHistory).toEqual([]);
  });

  it('should reject connection with invalid roomId', async () => {
    const client = connect('bad-id', 'Alice');
    const payload = await waitFor(client, 'error');

    expect(payload.type).toBe('validation');
  });

  it('should reject connection with invalid userName', async () => {
    const client = connect(VALID_ROOM, '<script>alert(1)</script>');
    const payload = await waitFor(client, 'error');

    expect(payload.type).toBe('validation');
  });

  it('should reject 5th participant with room-full', async () => {
    connect(VALID_ROOM, 'A');
    connect(VALID_ROOM, 'B');
    connect(VALID_ROOM, 'C');
    connect(VALID_ROOM, 'D');
    // Дать четырём подключиться
    await new Promise((resolve) => setTimeout(resolve, 100));

    const fifth = connect(VALID_ROOM, 'E');
    const payload = await waitFor(fifth, 'error');

    expect(payload.type).toBe('room-full');
  });

  it('should broadcast user-joined to existing participants', async () => {
    const alice = connect(VALID_ROOM, 'Alice');
    await waitFor(alice, 'room-joined');

    const userJoined = waitFor(alice, 'user-joined');
    connect(VALID_ROOM, 'Bob');

    const payload = await userJoined;
    expect(payload.userName).toBe('Bob');
    expect(payload.mediaState).toEqual({ audio: true, video: true });
  });

  it('should broadcast chat-message to all participants', async () => {
    const alice = connect(VALID_ROOM, 'Alice');
    await waitFor(alice, 'room-joined');
    const bob = connect(VALID_ROOM, 'Bob');
    await waitFor(bob, 'room-joined');

    const chatMsg = waitFor(alice, 'chat-message');
    bob.emit('chat-message', { message: 'Hello!' });

    const payload = await chatMsg;
    expect(payload.fromName).toBe('Bob');
    expect(payload.message).toBe('Hello!');
  });

  it('should sanitize XSS in chat messages', async () => {
    const alice = connect(VALID_ROOM, 'Alice');
    await waitFor(alice, 'room-joined');
    const bob = connect(VALID_ROOM, 'Bob');
    await waitFor(bob, 'room-joined');

    const chatMsg = waitFor(alice, 'chat-message');
    bob.emit('chat-message', { message: 'Hi <script>alert(1)</script> there' });

    const payload = await chatMsg;
    expect(payload.message).not.toContain('<script>');
    expect(payload.message).toContain('Hi');
  });

  it('should enforce rate limit (5 messages/sec)', async () => {
    const alice = connect(VALID_ROOM, 'Alice');
    await waitFor(alice, 'room-joined');

    let receivedCount = 0;
    alice.on('chat-message', () => receivedCount++);
    let rateLimitError = false;
    alice.on('error', (err) => {
      if (err.type === 'rate-limit') rateLimitError = true;
    });

    for (let i = 0; i < 7; i++) {
      alice.emit('chat-message', { message: `msg ${i}` });
    }

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(receivedCount).toBe(5);
    expect(rateLimitError).toBe(true);
  });

  it('should broadcast media-state-changed', async () => {
    const alice = connect(VALID_ROOM, 'Alice');
    await waitFor(alice, 'room-joined');
    const bob = connect(VALID_ROOM, 'Bob');
    await waitFor(bob, 'room-joined');

    const mediaChanged = waitFor(alice, 'media-state-changed');
    bob.emit('media-state', { audio: false, video: true });

    const payload = await mediaChanged;
    expect(payload.mediaState.audio).toBe(false);
  });

  it('should relay WebRTC offer to target', async () => {
    const alice = connect(VALID_ROOM, 'Alice');
    const aliceJoined = await waitFor(alice, 'room-joined');
    const bob = connect(VALID_ROOM, 'Bob');
    await waitFor(bob, 'room-joined');

    // Alice получает socketId Bob через user-joined
    const bobJoined = await waitFor(alice, 'user-joined');
    const bobSocketId = bobJoined.socketId;

    const offerReceived = waitFor(bob, 'offer');
    alice.emit('offer', { targetSocketId: bobSocketId, sdp: { type: 'offer', sdp: 'fake' } });

    const payload = await offerReceived;
    expect(payload.from).toBeDefined();
    expect(payload.sdp).toEqual({ type: 'offer', sdp: 'fake' });
  });

  it('should broadcast user-left on disconnect', async () => {
    const alice = connect(VALID_ROOM, 'Alice');
    await waitFor(alice, 'room-joined');
    const bob = connect(VALID_ROOM, 'Bob');
    await waitFor(bob, 'room-joined');

    const userLeft = waitFor(alice, 'user-left');
    bob.close();

    const payload = await userLeft;
    expect(payload.userName).toBe('Bob');
  });

  it('should delete room when last participant disconnects', async () => {
    const alice = connect(VALID_ROOM, 'Alice');
    await waitFor(alice, 'room-joined');

    expect(roomService.roomExists(VALID_ROOM)).toBe(true);

    alice.close();
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(roomService.roomExists(VALID_ROOM)).toBe(false);
  });
});
