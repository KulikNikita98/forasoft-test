import { describe, it, expect, beforeEach } from 'vitest';
import Participant from '../../src/models/Participant.js';

describe('Participant', () => {
  let participant;

  beforeEach(() => {
    participant = new Participant('socket-1', 'Alice');
  });

  it('should initialize with default media state enabled', () => {
    expect(participant.socketId).toBe('socket-1');
    expect(participant.userName).toBe('Alice');
    expect(participant.mediaState).toEqual({ audio: true, video: true });
  });

  it('should update audio state', () => {
    participant.updateMediaState({ audio: false });
    expect(participant.mediaState.audio).toBe(false);
    expect(participant.mediaState.video).toBe(true);
  });

  it('should update video state', () => {
    participant.updateMediaState({ video: false });
    expect(participant.mediaState.video).toBe(false);
    expect(participant.mediaState.audio).toBe(true);
  });

  it('should update both states', () => {
    participant.updateMediaState({ audio: false, video: false });
    expect(participant.mediaState).toEqual({ audio: false, video: false });
  });

  it('should serialize to JSON', () => {
    const json = participant.toJSON();
    expect(json).toEqual({
      socketId: 'socket-1',
      userName: 'Alice',
      mediaState: { audio: true, video: true }
    });
  });
});
