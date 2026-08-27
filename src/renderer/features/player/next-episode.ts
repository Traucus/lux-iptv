import type { Episode } from '../../../shared/types/ipc';

/**
 * Season structure for next-episode resolution.
 * Matches the SeriesDetail type from shared/types/ipc.ts
 */
export interface Season {
  seasonNumber: number;
  episodes: Episode[];
}

/**
 * Resolves the next episode in series order.
 *
 * Logic (per design §7.6 and desktop-shell spec §getNextEpisode):
 * 1. Prefer next episode in the same season (episode + 1)
 * 2. If at end of season, jump to first episode of next season
 * 3. Return null at end of series
 *
 * Seasons are sorted by seasonNumber to handle unordered input.
 * Empty seasons are skipped.
 */
export function resolveNextEpisode(current: Episode, seasons: Season[]): Episode | null {
  // Sort seasons by season number to handle unordered input
  const sortedSeasons = [...seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);

  // Find current season
  const currentSeason = sortedSeasons.find((s) => s.seasonNumber === current.season);
  if (!currentSeason) return null;

  // Find current episode index in current season
  const currentEpIndex = currentSeason.episodes.findIndex((ep) => ep.id === current.id);
  if (currentEpIndex === -1) return null;

  // Check for next episode in same season
  if (currentEpIndex + 1 < currentSeason.episodes.length) {
    return currentSeason.episodes[currentEpIndex + 1];
  }

  // At end of season - find next season with episodes
  const currentSeasonIndex = sortedSeasons.findIndex((s) => s.seasonNumber === current.season);
  for (let i = currentSeasonIndex + 1; i < sortedSeasons.length; i++) {
    const nextSeason = sortedSeasons[i];
    if (nextSeason.episodes.length > 0) {
      return nextSeason.episodes[0];
    }
  }

  // End of series
  return null;
}