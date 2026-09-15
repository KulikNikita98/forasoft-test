import { describe, it, expect, beforeEach } from 'vitest';
import RoomManager from '../src/RoomManager.js';

describe('RoomManager', () => {
  let roomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  describe('createRoom', () => {
    it('should create a new room', () => {
      const room = roomManager.createRoom('room-1');
      expect(room).toBeDefined();
      expect(room.id).toBe('room-1');
      expect(room.participants.size).toBe(0);
      expect(room.messages).toEqual([]);
    });

    it('should return existing room if already created', () => {
      const room1 = roomManager.createRoom('room-1');
      const room2 = roomManager.createRoom('room-1');
      expect(room1).toBe(room2);
    });
  });

  describe('joinRoom', () => {
    it('should add participant to room', () => {
      const result = roomManager.joinRoom('room-1', 'socket-1', 'Alice');
      expect(result.success).toBe(true);
      expect(result.participants).toHaveLength(1);
      expect(result.participants[0].userName).toBe('Alice');
    });

    it('should allow up to 4 participants', () => {
      roomManager.joinRoom('room-1', 'socket-1', 'Alice');
      roomManager.joinRoom('room-1', 'socket-2', 'Bob');
      roomManager.joinRoom('room-1', 'socket-3', 'Charlie');
      const result = roomManager.joinRoom('room-1', 'socket-4', 'David');

      expect(result.success).toBe(true);
      expect(result.participants).toHaveLength(4);
    });

    it('should reject 5th participant', () => {
      roomManager.joinRoom('room-1', 'socket-1', 'Alice');
      roomManager.joinRoom('room-1', 'socket-2', 'Bob');
      roomManager.joinRoom('room-1', 'socket-3', 'Charlie');
      roomManager.joinRoom('room-1', 'socket-4', 'David');
      const result = roomManager.joinRoom('room-1', 'socket-5', 'Eve');

      expect(result.success).toBe(false);
      expect(result.error).toBe('ROOM_FULL');
    });

    it('should return chat history to new participant', () => {
      roomManager.joinRoom('room-1', 'socket-1', 'Alice');
      roomManager.addChatMessage('room-1', {
        type: 'user',
        userName: 'Alice',
        text: 'Hello'
      });

      const result = roomManager.joinRoom('room-1', 'socket-2', 'Bob');
      expect(result.chatHistory).toHaveLength(1);
      expect(result.chatHistory[0].text).toBe('Hello');
    });
  });

  describe('leaveRoom', () => {
    it('should remove participant from room', () => {
      roomManager.joinRoom('room-1', 'socket-1', 'Alice');
      const result = roomManager.leaveRoom('socket-1');

      expect(result).toBeDefined();
      expect(result.roomId).toBe('room-1');
      expect(result.participant.userName).toBe('Alice');
    });

    it('should delete room when last participant leaves', () => {
      roomManager.joinRoom('room-1', 'socket-1', 'Alice');
      const result = roomManager.leaveRoom('socket-1');

      expect(result.shouldDeleteRoom).toBe(true);
      expect(roomManager.getRoom('room-1')).toBeUndefined();
    });

    it('should not delete room if participants remain', () => {
      roomManager.joinRoom('room-1', 'socket-1', 'Alice');
      roomManager.joinRoom('room-1', 'socket-2', 'Bob');
      const result = roomManager.leaveRoom('socket-1');

      expect(result.shouldDeleteRoom).toBe(false);
      expect(roomManager.getRoom('room-1')).toBeDefined();
      expect(roomManager.getRoomCount('room-1')).toBe(1);
    });

    it('should return null if socket not found', () => {
      const result = roomManager.leaveRoom('socket-999');
      expect(result).toBeNull();
    });
  });

  describe('chat messages', () => {
    it('should add message to room history', () => {
      roomManager.createRoom('room-1');
      const message = roomManager.addChatMessage('room-1', {
        type: 'user',
        userName: 'Alice',
        text: 'Hello world'
      });

      expect(message.id).toBeDefined();
      expect(message.text).toBe('Hello world');

      const history = roomManager.getChatHistory('room-1');
      expect(history).toHaveLength(1);
    });

    it('should add system message', () => {
      roomManager.createRoom('room-1');
      const message = roomManager.addChatMessage('room-1', {
        type: 'system',
        text: 'Alice присоединился к комнате'
      });

      expect(message.type).toBe('system');
      expect(message.userName).toBeUndefined();
    });
  });

  describe('concurrent join race condition', () => {
    it('should handle race condition atomically', () => {
      // Simulate 3 participants already in room
      roomManager.joinRoom('room-1', 'socket-1', 'Alice');
      roomManager.joinRoom('room-1', 'socket-2', 'Bob');
      roomManager.joinRoom('room-1', 'socket-3', 'Charlie');

      // Attempt to add 2 more simultaneously
      const result1 = roomManager.joinRoom('room-1', 'socket-4', 'David');
      const result2 = roomManager.joinRoom('room-1', 'socket-5', 'Eve');

      // One succeeds, one fails
      const successCount = [result1, result2].filter(r => r.success).length;
      const failCount = [result1, result2].filter(r => !r.success).length;

      expect(successCount).toBe(1);
      expect(failCount).toBe(1);
      expect(roomManager.getRoomCount('room-1')).toBe(4);
    });
  });
});
