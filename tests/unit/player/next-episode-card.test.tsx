// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

void React;
import '@testing-library/jest-dom';
import { NextEpisodeCard } from '../../../src/renderer/components/molecules/osd/NextEpisodeCard';
import type { Episode } from '../../../src/shared/types/ipc';

/**
 * TASK-065: NextEpisodeCard tests
 *
 * Tests the NextEpisodeCard component:
 * - 10s countdown
 * - navigate on expiry
 * - dismiss via ESC/Back
 */

describe('NextEpisodeCard', () => {
  const mockEpisode: Episode = {
    id: 2,
    seriesId: 1,
    name: 'The Next Episode',
    url: 'https://example.com/ep2',
    season: 1,
    episode: 2,
    cover: 'https://example.com/cover.jpg',
    addedAt: 1000,
  };

  let mockOnWatchNow: ReturnType<typeof vi.fn>;
  let mockOnDismiss: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnWatchNow = vi.fn();
    mockOnDismiss = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when not visible', () => {
    render(
      <NextEpisodeCard
        episode={mockEpisode}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={false}
      />,
    );

    expect(screen.queryByTestId('next-episode-card')).not.toBeInTheDocument();
  });

  it('renders nothing when episode is null', () => {
    render(
      <NextEpisodeCard
        episode={null}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={true}
      />,
    );

    expect(screen.queryByTestId('next-episode-card')).not.toBeInTheDocument();
  });

  it('renders episode info when visible', () => {
    render(
      <NextEpisodeCard
        episode={mockEpisode}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={true}
      />,
    );

    expect(screen.getByTestId('next-episode-card')).toBeInTheDocument();
    expect(screen.getByText('Next Episode')).toBeInTheDocument();
    expect(screen.getByText('S1E2: The Next Episode')).toBeInTheDocument();
    expect(screen.getByTestId('watch-now-button')).toBeInTheDocument();
    expect(screen.getByTestId('dismiss-button')).toBeInTheDocument();
  });

  it('countdown starts at 10s', () => {
    render(
      <NextEpisodeCard
        episode={mockEpisode}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={true}
      />,
    );

    expect(screen.getByTestId('countdown')).toHaveTextContent('10s');
  });

  it('countdown decrements every second', () => {
    render(
      <NextEpisodeCard
        episode={mockEpisode}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={true}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByTestId('countdown')).toHaveTextContent('7s');
  });

  it('calls onWatchNow when countdown expires', () => {
    render(
      <NextEpisodeCard
        episode={mockEpisode}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={true}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(mockOnWatchNow).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss when dismiss button clicked', () => {
    render(
      <NextEpisodeCard
        episode={mockEpisode}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={true}
      />,
    );

    fireEvent.click(screen.getByTestId('dismiss-button'));
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss on Escape key', () => {
    render(
      <NextEpisodeCard
        episode={mockEpisode}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={true}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss on Backspace key', () => {
    render(
      <NextEpisodeCard
        episode={mockEpisode}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={true}
      />,
    );

    fireEvent.keyDown(document, { key: 'Backspace' });
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onWatchNow when Watch Now button clicked', () => {
    render(
      <NextEpisodeCard
        episode={mockEpisode}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={true}
      />,
    );

    fireEvent.click(screen.getByTestId('watch-now-button'));
    expect(mockOnWatchNow).toHaveBeenCalledTimes(1);
  });

  it('cleans up timer on unmount', () => {
    const { unmount } = render(
      <NextEpisodeCard
        episode={mockEpisode}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={true}
      />,
    );

    unmount();

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(mockOnWatchNow).not.toHaveBeenCalled();
  });

  it('resets countdown when visibility toggles', () => {
    const { rerender } = render(
      <NextEpisodeCard
        episode={mockEpisode}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={true}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId('countdown')).toHaveTextContent('5s');

    rerender(
      <NextEpisodeCard
        episode={mockEpisode}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={false}
      />,
    );

    rerender(
      <NextEpisodeCard
        episode={mockEpisode}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={true}
      />,
    );

    expect(screen.getByTestId('countdown')).toHaveTextContent('10s');
  });
});
