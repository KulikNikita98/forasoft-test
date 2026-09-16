import { describe, it, expect, beforeEach } from 'vitest';
import Participant from '../../src/models/Participant.js';

describe('Participant', () => {
  let participant;

  beforeEach(() => {
    participant = new Participant('socket-1', 'Alice');
  });

  it('should initialize with media disabled by default', () => {
    // Устройства выключены при входе — участник включает их сам.
    // Это исключает захват общей камеры двумя клиентами на одном устройстве.
    expect(participant.socketId).toBe('socket-1');
    expect(participant.userName).toBe('Alice');
    expect(participant.mediaState).toEqual({ audio: false, video: false });
  });

  it('should update audio state', () => {
    participant.updateMediaState({ audio: true });
    expect(participant.mediaState.audio).toBe(true);
    expect(participant.mediaState.video).toBe(false);
  });

  it('should update video state', () => {
    participant.updateMediaState({ video: true });
    expect(participant.mediaState.video).toBe(true);
    expect(participant.mediaState.audio).toBe(false);
  });

  it('should update both states', () => {
    participant.updateMediaState({ audio: true, video: true });
    expect(participant.mediaState).toEqual({ audio: true, video: true });
  });

  it('should serialize to JSON', () => {
    const json = participant.toJSON();
    expect(json).toEqual({
      socketId: 'socket-1',
      userName: 'Alice',
      mediaState: { audio: false, video: false }
    });
  });
});
