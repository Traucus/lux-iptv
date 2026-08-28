import React, { useState } from 'react';
import { Focusable } from '../atoms/Focusable';

/**
 * EpisodeCard — presentational card for a single episode within a season grid.
 */
export interface EpisodeData {
  id: number;
  season: number;
  episode: number;
  name: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
  watched: boolean;
}

export interface EpisodeCardProps {
  episode: EpisodeData;
  onSelect?: (episode: EpisodeData) => void;
  className?: string;
}

export function EpisodeCard({ episode, onSelect, className = '' }: EpisodeCardProps): React.ReactElement {
  const [imgFailed, setImgFailed] = useState(false);
  const showThumb = episode.thumbnailUrl && !imgFailed;

  return (
    <Focusable
      onSelect={onSelect ? () => onSelect(episode) : undefined}
      className={`block ${className}`}
      aria-label={`Episode ${episode.episode}: ${episode.name}`}
    >
      <div className="flex gap-3 p-2 rounded-xl bg-glass-light border border-white/10 hover:border-primary-500/40 transition-colors">
        <div className="relative w-32 h-20 flex-shrink-0 bg-surface-100 rounded-md overflow-hidden">
          {showThumb ? (
            <img
              src={episode.thumbnailUrl ?? undefined}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600 text-xl">
              ▶
            </div>
          )}
          {episode.watched ? (
            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">
            Ep. {episode.episode} — {episode.name}
          </p>
          {episode.durationSec ? (
            <p className="text-xs text-gray-400">{formatDuration(episode.durationSec)}</p>
          ) : null}
        </div>
      </div>
    </Focusable>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export default EpisodeCard;
