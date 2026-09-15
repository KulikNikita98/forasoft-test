import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import RoomService from '../../src/services/RoomService.js';
import RoomController from '../../src/controllers/RoomController.js';
import { createApiRouter } from '../../src/routes/api.js';

const silentLogger = { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} };

describe('RoomController (REST API)', () => {
  let app;
  let server;
  let roomService;
  let baseUrl;

  beforeEach(async () => {
    roomService = new RoomService();
    const roomController = new RoomController(roomService, silentLogger);

    app = express();
    app.use(express.json());
    app.use('/api', createApiRouter(roomController));

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://localhost:${server.address().port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  describe('POST /api/rooms', () => {
    it('should create a room and return roomId', async () => {
      const res = await fetch(`${baseUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: 'Alice' })
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.roomId).toBeDefined();
      expect(body.createdAt).toBeDefined();
    });

    it('should return 400 without userName', async () => {
      const res = await fetch(`${baseUrl}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/rooms/:roomId', () => {
    it('should return room info for existing room', async () => {
      const room = roomService.createRoom('room-1');
      room.addParticipant('s1', 'Alice');

      const res = await fetch(`${baseUrl}/api/rooms/room-1`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.exists).toBe(true);
      expect(body.participantCount).toBe(1);
      expect(body.isFull).toBe(false);
    });

    it('should return 404 for non-existent room', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/nonexistent`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/rooms/:roomId/participants', () => {
    it('should return participants list', async () => {
      const room = roomService.createRoom('room-1');
      room.addParticipant('s1', 'Alice');
      room.addParticipant('s2', 'Bob');

      const res = await fetch(`${baseUrl}/api/rooms/room-1/participants`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.participants).toHaveLength(2);
      expect(body.participants[0].userName).toBeDefined();
    });

    it('should return 404 for non-existent room', async () => {
      const res = await fetch(`${baseUrl}/api/rooms/nonexistent/participants`);
      expect(res.status).toBe(404);
    });
  });
});
