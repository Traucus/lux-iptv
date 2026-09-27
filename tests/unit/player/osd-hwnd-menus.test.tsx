// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

void React;

import { VideoPlayerOsdChrome } from '../../../src/renderer/components/organisms/video-player/osd-chrome';

const noop = vi.fn();

function renderChrome() {
  return render(
    <VideoPlayerOsdChrome
      sourceType="movie"
      currentTime={10}
      duration={100}
      buffered={[{ start: 0, end: 20 }]}
      isPlaying
      audioTrackIndex={1}
      audioTracks={[
        { id: 1, name: 'English' },
        { id: 2, name: 'Spanish' },
      ]}
      subtitleTrackIndex={1}
      subtitleTracks={[{ id: 1, name: 'sub 1' }]}
      aspectRatio="16:9"
      onSeek={noop}
      onRewind10={noop}
      onPlayPause={noop}
      onForward10={noop}
      onAudioTrackChange={noop}
      onSubtitleTrackChange={noop}
      onAspectRatioChange={noop}
      onFullscreen={noop}
      onLoadSubtitle={noop}
    />,
  );
}

describe('OSD menus stay in HWND inset', () => {
  it('keeps the subtitle track panel inside osd-chrome-bottom without position:fixed', () => {
    renderChrome();
    fireEvent.click(screen.getByTestId('osd-subtitle-button'));
    const bottom = screen.getByTestId('osd-chrome-bottom');
    const modal = screen.getByTestId('track-selector-modal');
    expect(bottom).toContainElement(modal);
    expect(modal).toHaveStyle({ position: 'absolute' });
    expect(modal).not.toHaveStyle({ position: 'fixed' });
    expect(screen.getByText('sub 1')).toBeInTheDocument();
  });

  it('keeps the audio track panel inside osd-chrome-bottom', () => {
    renderChrome();
    fireEvent.click(screen.getByTestId('osd-audio-button'));
    const bottom = screen.getByTestId('osd-chrome-bottom');
    const modal = screen.getByTestId('track-selector-modal');
    expect(bottom).toContainElement(modal);
    expect(modal).toHaveStyle({ position: 'absolute' });
  });

  it('keeps the aspect-ratio menu inside osd-chrome-bottom', () => {
    renderChrome();
    fireEvent.click(screen.getByTestId('aspect-ratio-button'));
    const bottom = screen.getByTestId('osd-chrome-bottom');
    const menu = screen.getByTestId('aspect-ratio-menu');
    expect(bottom).toContainElement(menu);
    expect(menu).toHaveStyle({ position: 'absolute' });
    expect(menu).not.toHaveStyle({ position: 'fixed' });
  });

  it('clips chrome overflow so popovers cannot paint into the HWND hole', () => {
    renderChrome();
    expect(screen.getByTestId('osd-chrome-bottom')).toHaveStyle({ overflow: 'hidden' });
    expect(screen.getByTestId('osd-chrome-top')).toHaveStyle({ overflow: 'hidden' });
  });
});
