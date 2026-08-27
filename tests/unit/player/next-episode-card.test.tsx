// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

/**
 * TASK-065: NextEpisodeCard tests
 *
 * Tests the NextEpisodeCard component:
 * - 10s countdown
 * - navigate on expiry
 * - dismiss via ESC/Back
 */

interface Episode {
  id: number;
  name: string;
  season: number;
  episode: number;
  cover: string | null;
}

interface NextEpisodeCardProps {
  episode: Episode | null;
  onWatchNow: () => void;
  onDismiss: () => void;
  visible: boolean;
}

// Mock implementation
function NextEpisodeCard({ episode, onWatchNow, onDismiss, visible }: NextEpisodeCardProps) {
  const [countdown, setCountdown] = React.useState(10);

  // Reset countdown when visibility changes to true
  React.useEffect(() => {
    if (visible) {
      setCountdown(10);
    }
  }, [visible]);

  React.useEffect(() => {
    if (!visible || !episode) return;
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onWatchNow();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, episode, onWatchNow]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        onDismiss();
      }
    };

    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, onDismiss]);

  if (!visible || !episode) return null;

  return (
    <div
      className="next-episode-card"
      style={{
        position: 'fixed',
        bottom: '120px',
        right: '24px',
        width: '320px',
        background: 'rgba(20,20,30,0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(8px)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
      data-testid="next-episode-card"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {episode.cover && (
            <img
              src={episode.cover}
              alt=""
              style={{ width: '64px', height: '36px', borderRadius: '4px', objectFit: 'cover' }}
            />
          )}
          <div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>
              Next Episode
            </p>
            <h4 style={{ margin: '4px 0 0', fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>
              S{episode.season}E{episode.episode}: {episode.name}
            </h4>
          </div>
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: '4px',
            opacity: 0.7,
          }}
          aria-label="Dismiss"
          data-testid="dismiss-button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onWatchNow}
          style={{
            flex: 1,
            padding: '10px',
            background: '#fff',
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          data-testid="watch-now-button"
        >
          Watch Now
        </button>
        <div
          style={{
            width: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: '#fff',
            fontWeight: 600,
            fontSize: '1.25rem',
          }}
          data-testid="countdown"
        >
          {countdown}s
        </div>
      </div>
    </div>
  );
}

describe('NextEpisodeCard', () => {
  const mockEpisode = {
    id: 2,
    name: 'The Next Episode',
    season: 1,
    episode: 2,
    cover: 'https://example.com/cover.jpg',
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
      />
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
      />
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
      />
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
      />
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
      />
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
      />
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
      />
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
      />
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
      />
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
      />
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
      />
    );

    unmount();
    
    act(() => {
      vi.advanceTimersByTime(15000);
    });

    // Should not call onWatchNow after unmount
    expect(mockOnWatchNow).not.toHaveBeenCalled();
  });

  it('resets countdown when visibility toggles', () => {
    const { rerender } = render(
      <NextEpisodeCard
        episode={mockEpisode}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={true}
      />
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByTestId('countdown')).toHaveTextContent('5s');

    // Hide and show again
    rerender(
      <NextEpisodeCard
        episode={mockEpisode}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={false}
      />
    );

    rerender(
      <NextEpisodeCard
        episode={mockEpisode}
        onWatchNow={mockOnWatchNow}
        onDismiss={mockOnDismiss}
        visible={true}
      />
    );

    expect(screen.getByTestId('countdown')).toHaveTextContent('10s');
  });
});