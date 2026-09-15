import { describe, it, expect, beforeEach } from 'vitest';
import Room from '../../src/models/Room.js';

describe('Room', () => {
  let room;

  beforeEach(() => {
    room = new Room('room-1');
  });

  it('should initialize with empty participants and chat', () => {
    expect(room.roomId).toBe('room-1');
    expect(room.participants.size).toBe(0);
    expect(room.chatHistory).toEqual([]);
    expect(room.maxParticipants).toBe(4);
  });

  it('should add participant', () => {
    const p = room.addParticipant('socket-1', 'Alice');
    expect(p.userName).toBe('Alice');
    expect(room.participants.size).toBe(1);
  });

  it('should remove participant', () => {
    room.addParticipant('socket-1', 'Alice');
    const removed = room.removeParticipant('socket-1');
    expect(removed.userName).toBe('Alice');
    expect(room.participants.size).toBe(0);
  });

  it('should report isFull at 4 participants', () => {
    room.addParticipant('s1', 'A');
    room.addParticipant('s2', 'B');
    room.addParticipant('s3', 'C');
    expect(room.isFull()).toBe(false);
    room.addParticipant('s4', 'D');
    expect(room.isFull()).toBe(true);
  });

  it('should report isEmpty', () => {
    expect(room.isEmpty()).toBe(true);
    room.addParticipant('s1', 'A');
    expect(room.isEmpty()).toBe(false);
  });

  it('should atomically add participant via tryAddParticipant', () => {
    const result = room.tryAddParticipant('s1', 'Alice');
    expect(result.success).toBe(true);
    expect(result.participant.userName).toBe('Alice');
    expect(room.participants.size).toBe(1);
  });

  it('should reject via tryAddParticipant when room is full (C2)', () => {
    room.tryAddParticipant('s1', 'A');
    room.tryAddParticipant('s2', 'B');
    room.tryAddParticipant('s3', 'C');
    room.tryAddParticipant('s4', 'D');
    const result = room.tryAddParticipant('s5', 'E');
    expect(result.success).toBe(false);
    expect(result.error).toBe('room-full');
    expect(room.participants.size).toBe(4);
  });

  it('should add chat message with generated id', () => {
    const msg = room.addChatMessage({ type: 'user', message: 'Hi' });
    expect(msg.id).toBeDefined();
    expect(room.chatHistory).toHaveLength(1);
  });

  it('should serialize to JSON', () => {
    room.addParticipant('s1', 'Alice');
    const json = room.toJSON();
    expect(json.roomId).toBe('room-1');
    expect(json.participantCount).toBe(1);
    expect(json.participants).toHaveLength(1);
    expect(json.isFull).toBe(false);
  });
});
