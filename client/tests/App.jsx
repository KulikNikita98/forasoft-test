import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Мокаем проверку WebRTC — управляем ею из тестов
vi.mock('../src/utils/webrtcSupport.js', () => ({
  isWebRTCSupported: vi.fn()
}));

import { isWebRTCSupported } from '../src/utils/webrtcSupport.js';
import App from '../src/App.jsx';

describe('App routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('shows UnsupportedBrowser when WebRTC is not supported', () => {
    isWebRTCSupported.mockReturnValue(false);
    render(<App />);
    expect(screen.getByText('Браузер не поддерживается')).toBeInTheDocument();
  });

  it('renders StartScreen on / when WebRTC is supported', () => {
    isWebRTCSupported.mockReturnValue(true);
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(screen.getByText('Видеочат-комната')).toBeInTheDocument();
  });

  it('renders RoomScreen on /room/:roomId', () => {
    isWebRTCSupported.mockReturnValue(true);
    window.history.pushState({}, '', '/room/abc-123');
    render(<App />);
    expect(screen.getByText(/Комната:/)).toBeInTheDocument();
    expect(screen.getByText(/abc-123/)).toBeInTheDocument();
  });
});
