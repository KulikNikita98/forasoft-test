import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Controls from '../../../src/components/controls/Controls.jsx';

describe('Controls', () => {
  it('отображает все три кнопки управления', () => {
    render(
      <Controls
        isMicEnabled={true}
        isVideoEnabled={true}
        onToggleMic={vi.fn()}
        onToggleVideo={vi.fn()}
        onLeave={vi.fn()}
      />
    );

    expect(screen.getByTitle('Выключить микрофон')).toBeInTheDocument();
    expect(screen.getByTitle('Выключить камеру')).toBeInTheDocument();
    expect(screen.getByText('Выйти')).toBeInTheDocument();
  });

  it('показывает правильные иконки когда микрофон включен', () => {
    render(
      <Controls
        isMicEnabled={true}
        isVideoEnabled={true}
        onToggleMic={vi.fn()}
        onToggleVideo={vi.fn()}
        onLeave={vi.fn()}
      />
    );

    expect(screen.getByText('🎤')).toBeInTheDocument();
    expect(screen.queryByText('🔇')).not.toBeInTheDocument();
  });

  it('показывает правильные иконки когда микрофон выключен', () => {
    render(
      <Controls
        isMicEnabled={false}
        isVideoEnabled={true}
        onToggleMic={vi.fn()}
        onToggleVideo={vi.fn()}
        onLeave={vi.fn()}
      />
    );

    expect(screen.getByText('🔇')).toBeInTheDocument();
    expect(screen.queryByText('🎤')).not.toBeInTheDocument();
  });

  it('показывает правильные иконки когда камера включена', () => {
    render(
      <Controls
        isMicEnabled={true}
        isVideoEnabled={true}
        onToggleMic={vi.fn()}
        onToggleVideo={vi.fn()}
        onLeave={vi.fn()}
      />
    );

    expect(screen.getByText('📹')).toBeInTheDocument();
  });

  it('показывает правильные иконки когда камера выключена', () => {
    render(
      <Controls
        isMicEnabled={true}
        isVideoEnabled={false}
        onToggleMic={vi.fn()}
        onToggleVideo={vi.fn()}
        onLeave={vi.fn()}
      />
    );

    expect(screen.getByText('📷')).toBeInTheDocument();
  });

  it('вызывает onToggleMic при клике на кнопку микрофона', async () => {
    const user = userEvent.setup();
    const handleToggleMic = vi.fn();

    render(
      <Controls
        isMicEnabled={true}
        isVideoEnabled={true}
        onToggleMic={handleToggleMic}
        onToggleVideo={vi.fn()}
        onLeave={vi.fn()}
      />
    );

    await user.click(screen.getByTitle('Выключить микрофон'));
    expect(handleToggleMic).toHaveBeenCalledTimes(1);
  });

  it('вызывает onToggleVideo при клике на кнопку камеры', async () => {
    const user = userEvent.setup();
    const handleToggleVideo = vi.fn();

    render(
      <Controls
        isMicEnabled={true}
        isVideoEnabled={true}
        onToggleMic={vi.fn()}
        onToggleVideo={handleToggleVideo}
        onLeave={vi.fn()}
      />
    );

    await user.click(screen.getByTitle('Выключить камеру'));
    expect(handleToggleVideo).toHaveBeenCalledTimes(1);
  });

  it('вызывает onLeave при клике на кнопку выхода', async () => {
    const user = userEvent.setup();
    const handleLeave = vi.fn();

    render(
      <Controls
        isMicEnabled={true}
        isVideoEnabled={true}
        onToggleMic={vi.fn()}
        onToggleVideo={vi.fn()}
        onLeave={handleLeave}
      />
    );

    await user.click(screen.getByText('Выйти'));
    expect(handleLeave).toHaveBeenCalledTimes(1);
  });

  it('применяет красный фон когда микрофон выключен', () => {
    const { container } = render(
      <Controls
        isMicEnabled={false}
        isVideoEnabled={true}
        onToggleMic={vi.fn()}
        onToggleVideo={vi.fn()}
        onLeave={vi.fn()}
      />
    );

    const micButton = screen.getByTitle('Включить микрофон');
    expect(micButton.className).toContain('bg-red-600');
  });

  it('применяет серый фон когда микрофон включен', () => {
    const { container } = render(
      <Controls
        isMicEnabled={true}
        isVideoEnabled={true}
        onToggleMic={vi.fn()}
        onToggleVideo={vi.fn()}
        onLeave={vi.fn()}
      />
    );

    const micButton = screen.getByTitle('Выключить микрофон');
    expect(micButton.className).toContain('bg-gray-700');
  });

  it('применяет красный фон когда камера выключена', () => {
    render(
      <Controls
        isMicEnabled={true}
        isVideoEnabled={false}
        onToggleMic={vi.fn()}
        onToggleVideo={vi.fn()}
        onLeave={vi.fn()}
      />
    );

    const videoButton = screen.getByTitle('Включить камеру');
    expect(videoButton.className).toContain('bg-red-600');
  });

  it('применяет серый фон когда камера включена', () => {
    render(
      <Controls
        isMicEnabled={true}
        isVideoEnabled={true}
        onToggleMic={vi.fn()}
        onToggleVideo={vi.fn()}
        onLeave={vi.fn()}
      />
    );

    const videoButton = screen.getByTitle('Выключить камеру');
    expect(videoButton.className).toContain('bg-gray-700');
  });
});
