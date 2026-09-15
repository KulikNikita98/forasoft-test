import { describe, it, expect, afterEach, vi } from 'vitest';
import { isWebRTCSupported } from '../../src/utils/webrtcSupport.js';

describe('isWebRTCSupported', () => {
  const originalRTC = window.RTCPeerConnection;
  const originalMediaDevices = navigator.mediaDevices;

  afterEach(() => {
    window.RTCPeerConnection = originalRTC;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: originalMediaDevices,
      configurable: true
    });
  });

  it('returns true when RTCPeerConnection and getUserMedia exist', () => {
    window.RTCPeerConnection = function () {};
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => {} },
      configurable: true
    });
    expect(isWebRTCSupported()).toBe(true);
  });

  it('returns false without RTCPeerConnection', () => {
    window.RTCPeerConnection = undefined;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: () => {} },
      configurable: true
    });
    expect(isWebRTCSupported()).toBe(false);
  });

  it('returns false without getUserMedia', () => {
    window.RTCPeerConnection = function () {};
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {},
      configurable: true
    });
    expect(isWebRTCSupported()).toBe(false);
  });

  it('returns false without mediaDevices', () => {
    window.RTCPeerConnection = function () {};
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      configurable: true
    });
    expect(isWebRTCSupported()).toBe(false);
  });
});
