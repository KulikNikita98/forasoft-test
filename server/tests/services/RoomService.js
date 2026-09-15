import { describe, it, expect, beforeEach } from 'vitest';
import RoomService from '../../src/services/RoomService.js';

describe('RoomService', () => {
  let service;

  beforeEach(() => {
    service = new RoomService();
  });

  describe('room lifecycle', () => {
    it('should create a room', () => {
      const room = service.createRoom('room-1');
      expect(room.roomId).toBe('room-1');
      expect(service.roomExists('room-1')).toBe(true);
    });

    it('should get or create room', () => {
      const room1 = service.getOrCreateRoom('room-1');
      const room2 = service.getOrCreateRoom('room-1');
      expect(room1).toBe(room2);
    });

    it('should delete room', () => {
      service.createRoom('room-1');
      service.deleteRoom('room-1');
      expect(service.roomExists('room-1')).toBe(false);
    });
  });

  describe('addParticipant', () => {
    it('should add participant to new room', () => {
      const result = service.addParticipant('room-1', 'socket-1', 'Alice');
      expect(result.success).toBe(true);
      expect(result.participant.userName).toBe('Alice');
    });

    it('should allow up to 4 participants', () => {
      service.addParticipant('room-1', 's1', 'A');
      service.addParticipant('room-1', 's2', 'B');
      service.addParticipant('room-1', 's3', 'C');
      const result = service.addParticipant('room-1', 's4', 'D');
      expect(result.success).toBe(true);
    });

    it('should reject 5th participant with room-full', () => {
      service.addParticipant('room-1', 's1', 'A');
      service.addParticipant('room-1', 's2', 'B');
      service.addParticipant('room-1', 's3', 'C');
      service.addParticipant('room-1', 's4', 'D');
      const result = service.addParticipant('room-1', 's5', 'E');
      expect(result.success).toBe(false);
      expect(result.error).toBe('room-full');
    });
  });

  describe('removeParticipant', () => {
    it('should remove participant', () => {
      service.addParticipant('room-1', 'socket-1', 'Alice');
      const result = service.removeParticipant('room-1', 'socket-1');
      expect(result.participant.userName).toBe('Alice');
    });

    it('should delete room when last participant leaves', () => {
      service.addParticipant('room-1', 'socket-1', 'Alice');
      const result = service.removeParticipant('room-1', 'socket-1');
      expect(result.shouldDeleteRoom).toBe(true);
      expect(service.roomExists('room-1')).toBe(false);
    });

    it('should keep room when participants remain', () => {
      service.addParticipant('room-1', 's1', 'A');
      service.addParticipant('room-1', 's2', 'B');
      const result = service.removeParticipant('room-1', 's1');
      expect(result.shouldDeleteRoom).toBe(false);
      expect(service.roomExists('room-1')).toBe(true);
    });

    it('should handle removing from non-existent room', () => {
      const result = service.removeParticipant('room-x', 'socket-1');
      expect(result.shouldDeleteRoom).toBe(false);
      expect(result.participant).toBeUndefined();
    });
  });

  describe('media state', () => {
    it('should update participant media state', () => {
      service.addParticipant('room-1', 'socket-1', 'Alice');
      const updated = service.updateMediaState('room-1', 'socket-1', { audio: false });
      expect(updated).toBe(true);
    });

    it('should return false for non-existent participant', () => {
      const updated = service.updateMediaState('room-x', 'socket-1', { audio: false });
      expect(updated).toBe(false);
    });
  });

  describe('chat', () => {
    it('should add chat message', () => {
      service.createRoom('room-1');
      const msg = service.addChatMessage('room-1', { type: 'user', message: 'Hi' });
      expect(msg.id).toBeDefined();
    });

    it('should return null for non-existent room', () => {
      const msg = service.addChatMessage('room-x', { message: 'Hi' });
      expect(msg).toBeNull();
    });

    it('should get chat history', () => {
      service.createRoom('room-1');
      service.addChatMessage('room-1', { type: 'user', message: 'Hi' });
      const history = service.getChatHistory('room-1');
      expect(history).toHaveLength(1);
    });
  });
});
