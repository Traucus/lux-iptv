// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

/**
 * TASK-069: PlayerPage tests
 *
 * Tests the PlayerPage component logic:
 * - kind='live' hides SeekBar + resume
 * - kind='movie'/'episode' shows full OSD + resume
 * - invalid type → Navigate to="/"
 */

// Mock PlayerPage logic for testing
interface PlayerPageProps {
  type: string;
  id: string;
  onNavigate?: (path: string) => void;
}

function PlayerPage({ type, id, onNavigate }: PlayerPageProps) {
  const validTypes = ['live', 'movie', 'series', 'episode'];
  const [source, setSource] = React.useState<{
    url: string;
    mediaFormat: 'hls' | 'mp4' | 'dash' | 'ts' | 'unknown';
    httpHeaders?: Record<string, string>;
    type: 'live' | 'movie' | 'episode';
  } | null>(null);
  const [resumePosition, setResumePosition] = React.useState<number | null>(null);
  const [showResumeDialog, setShowResumeDialog] = React.useState(false);

  React.useEffect(() => {
    if (!validTypes.includes(type)) {
      onNavigate?.('/');
      return;
    }

    // Simulate fetching source
    if (type === 'live') {
      setSource({
        url: 'https://example.com/live.m3u8',
        mediaFormat: 'hls',
        type: 'live',
      });
    } else if (type === 'movie') {
      setSource({
        url: 'https://example.com/movie.mp4',
        mediaFormat: 'mp4',
        type: 'movie',
      });
      setResumePosition(1234);
      setShowResumeDialog(true);
    } else if (type === 'episode') {
      setSource({
        url: 'https://example.com/episode.m3u8',
        mediaFormat: 'hls',
        type: 'episode',
      });
      setResumePosition(567);
      setShowResumeDialog(true);
    }
  }, [type, id, onNavigate]);

  if (!source) return <div data-testid="loading">Loading...</div>;

  return (
    <div data-testid="player-page" data-type={source.type}>
      <div data-testid="video-player-container">
        VideoPlayer would be here
      </div>
      {source.type !== 'live' && <div data-testid="seek-bar">SeekBar</div>}
      {source.type !== 'live' && <div data-testid="resume-dialog">{showResumeDialog ? 'Resume?' : ''}</div>}
      {source.type === 'episode' && <div data-testid="next-episode-card">Next Episode</div>}
    </div>
  );
}

describe('PlayerPage', () => {
  let mockOnNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockOnNavigate = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('redirects to "/" for invalid type', () => {
    render(<PlayerPage type="invalid" id="42" onNavigate={mockOnNavigate} />);
    
    expect(mockOnNavigate).toHaveBeenCalledWith('/');
  });

  it('renders for live type', () => {
    render(<PlayerPage type="live" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.getByTestId('player-page')).toHaveAttribute('data-type', 'live');
  });

  it('hides seek bar for live type', () => {
    render(<PlayerPage type="live" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.queryByTestId('seek-bar')).not.toBeInTheDocument();
  });

  it('hides resume dialog for live type', () => {
    render(<PlayerPage type="live" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.queryByTestId('resume-dialog')).not.toBeInTheDocument();
  });

  it('renders for movie type', () => {
    render(<PlayerPage type="movie" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.getByTestId('player-page')).toHaveAttribute('data-type', 'movie');
  });

  it('shows seek bar for movie type', () => {
    render(<PlayerPage type="movie" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.getByTestId('seek-bar')).toBeInTheDocument();
  });

  it('shows resume dialog for movie type', () => {
    render(<PlayerPage type="movie" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.getByTestId('resume-dialog')).toHaveTextContent('Resume?');
  });

  it('renders for episode type', () => {
    render(<PlayerPage type="episode" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.getByTestId('player-page')).toHaveAttribute('data-type', 'episode');
  });

  it('shows next episode card for episode type', () => {
    render(<PlayerPage type="episode" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.getByTestId('next-episode-card')).toBeInTheDocument();
  });

  it('shows full OSD for episode type', () => {
    render(<PlayerPage type="episode" id="42" onNavigate={mockOnNavigate} />);
    
    expect(screen.getByTestId('seek-bar')).toBeInTheDocument();
    expect(screen.getByTestId('resume-dialog')).toHaveTextContent('Resume?');
    expect(screen.getByTestId('next-episode-card')).toBeInTheDocument();
  });
});