import React from 'react';
import { Spinner } from '../atoms/Spinner';
import { ProgressBar } from '../atoms/ProgressBar';
import { Button } from '../atoms/Button';

/**
 * ProgressOverlay — non-blocking ingestion progress indicator.
 * Glassmorphic centered overlay with live/movies/series counts and animated progress bar.
 */
export type IngestPhase = 'FETCH' | 'FETCH_LIVE' | 'FETCH_VOD' | 'FETCH_SERIES' | 'ITEMS' | 'CLASSIFY' | 'PERSIST' | 'DONE' | 'ERROR';

export interface IngestCounts {
  live: number;
  movies: number;
  series: number;
  radio: number;
  total: number;
}

export interface ProgressOverlayProps {
  phase: IngestPhase;
  percent: number;
  counts: IngestCounts;
  errorMessage?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
}

export function ProgressOverlay({
  phase,
  percent,
  counts,
  errorMessage,
  onRetry,
  onCancel,
}: ProgressOverlayProps): React.ReactElement {
  const isError = phase === 'ERROR';
  const isDone = phase === 'DONE';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-lg"
      role="dialog"
      aria-modal="true"
      aria-label="Ingestion progress"
    >
      <div className="w-full max-w-lg mx-4 p-8 rounded-2xl glass-heavy shadow-glass-lg animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          {!isError && !isDone ? <Spinner size="md" /> : null}
          <h2 className="text-2xl font-semibold text-white">
            {isError ? 'Ingestion Failed' : isDone ? 'Ingestion Complete!' : 'Processing IPTV Playlist…'}
          </h2>
        </div>

        <ProgressBar value={percent} showPercent className="mb-6" />

        <div className="grid grid-cols-3 gap-3 mb-6">
          <CountCard label="Live TV" value={counts.live} active={isPhaseActive(phase, 'live')} />
          <CountCard label="Movies" value={counts.movies} active={isPhaseActive(phase, 'movies')} />
          <CountCard label="Series" value={counts.series} active={isPhaseActive(phase, 'series')} />
        </div>

        <p className="text-xs text-gray-400 text-center uppercase tracking-wide mb-6">
          Phase: <span className="text-gray-200 font-medium">{phase}</span>
        </p>

        {isError && errorMessage ? (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/40">
            <p className="text-sm text-red-300">{errorMessage}</p>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          {isError && onRetry ? (
            <Button onClick={onRetry} variant="primary">
              Retry
            </Button>
          ) : null}
          {!isError && !isDone && onCancel ? (
            <Button onClick={onCancel} variant="glass">
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CountCard({
  label,
  value,
  active,
}: {
  label: string;
  value: number;
  active: boolean;
}): React.ReactElement {
  return (
    <div
      className={[
        'p-3 rounded-lg text-center border transition-colors',
        active ? 'bg-primary-500/15 border-primary-500/40' : 'bg-glass border-white/10',
      ].join(' ')}
    >
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function isPhaseActive(_phase: IngestPhase, _target: 'live' | 'movies' | 'series'): boolean {
  // Active during ingest work phases; reserved for future per-type state tracking.
  return true;
}

export default ProgressOverlay;
