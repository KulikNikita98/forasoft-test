import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import RoomService from '../../src/services/RoomService.js';
import RoomController from '../../src/controllers/RoomController.js';
import SocketController from '../../src/controllers/SocketController.js';
import { createApiRouter } from '../../src/routes/api.js';

const silentLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };

/**
 * Интеграционный тест полного сценария US-2 / US-4:
 * создать комнату через REST → войти в неё через WebSocket с полученным roomId.
 * Именно этот сценарий ловит баг C1 (генерация ≠ валидация roomId).
 * Транспорт HTTP (не HTTPS) — логика REST/WS от TLS не зависит.
 */
describe('Integration: REST create → WebSocket join', () => {
  let server;
  let io;
  let roomService;
  let port;
  const clients = [];

  beforeEach(async () => {
    roomService = new RoomService();

    const app = express();
    app.use(express.json());
    const roomController = new RoomController(roomService, silentLogger);
    app.use('/api', createApiRouter(roomController));

    server = createServer(app);

    io = new Server(server);
    const socketController = new SocketController(io, roomService, silentLogger);
    io.on('connection', (socket) => socketController.handleConnection(socket));

    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    clients.forEach((c) => c.close());
    clients.length = 0;
    io.close();
    await new Promise((resolve) => server.close(resolve));
  });

  async function createRoom(userName) {
    const res = await fetch(`http://localhost:${port}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName })
    });
    return res.json();
  }

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
    return new Promise((resolve, reject) => {
      client.on(event, resolve);
      client.on('error', reject);
    });
  }

  it('should allow joining a room created via REST (C1 regression)', async () => {
    // 1. Создать комнату через REST
    const { roomId } = await createRoom('Alice');
    expect(roomId).toBeDefined();

    // 2. Войти в неё по WebSocket с полученным roomId
    const alice = connect(roomId, 'Alice');
    const joined = await waitFor(alice, 'room-joined');

    expect(joined.participants).toEqual([]);
    expect(joined.chatHistory).toEqual([]);
    expect(roomService.roomExists(roomId)).toBe(true);
  });

  it('should run full scenario: create, two participants, chat, disconnect', async () => {
    const { roomId } = await createRoom('Alice');

    // Первый участник
    const alice = connect(roomId, 'Alice');
    await waitFor(alice, 'room-joined');

    // Второй участник → Alice получает user-joined
    const aliceSeesBob = waitFor(alice, 'user-joined');
    const bob = connect(roomId, 'Bob');
    await waitFor(bob, 'room-joined');
    const bobInfo = await aliceSeesBob;
    expect(bobInfo.userName).toBe('Bob');

    // Чат: Bob пишет → Alice получает
    const aliceGetsMsg = waitFor(alice, 'chat-message');
    bob.emit('chat-message', { message: 'Привет!' });
    const msg = await aliceGetsMsg;
    expect(msg.fromName).toBe('Bob');
    expect(msg.message).toBe('Привет!');

    // Bob выходит → Alice получает user-left
    const aliceSeesLeft = waitFor(alice, 'user-left');
    bob.close();
    const left = await aliceSeesLeft;
    expect(left.userName).toBe('Bob');

    // Alice выходит → комната удаляется
    alice.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(roomService.roomExists(roomId)).toBe(false);
  });
});
