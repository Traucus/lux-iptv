import React from 'react';
import { EpisodeCard, type EpisodeData } from '../molecules/EpisodeCard';

/**
 * EpisodeGrid organism — responsive grid layout for episodes within a season.
 */
export interface EpisodeGridProps {
  episodes: EpisodeData[];
  onSelectEpisode?: (episode: EpisodeData) => void;
  className?: string;
}

export function EpisodeGrid({ episodes, onSelectEpisode, className = '' }: EpisodeGridProps): React.ReactElement {
  if (episodes.length === 0) {
    return (
      <div className={`text-sm text-gray-400 ${className}`} aria-live="polite">
        No episodes available.
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${className}`} role="list">
      {episodes.map((episode) => (
        <EpisodeCard
          key={episode.id}
          episode={episode}
          onSelect={onSelectEpisode ? () => onSelectEpisode(episode) : undefined}
        />
      ))}
    </div>
  );
}

export default EpisodeGrid;
