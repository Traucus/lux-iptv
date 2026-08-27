// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { resolveNextEpisode, Season } from '../../../src/renderer/features/player/next-episode';
import type { Episode } from '../../../shared/types/ipc';

describe('resolveNextEpisode', () => {
  const createEpisode = (id: number, season: number, episode: number): Episode => ({
    id,
    seriesId: 1,
    name: `Episode ${episode}`,
    url: `https://example.com/ep${id}.m3u8`,
    season,
    episode,
    cover: null,
    addedAt: Date.now(),
  });

  const createSeason = (seasonNumber: number, episodes: Episode[]): Season => ({
    seasonNumber,
    episodes,
  });

  it('returns next episode in same season', () => {
    const ep1 = createEpisode(1, 1, 1);
    const ep2 = createEpisode(2, 1, 2);
    const ep3 = createEpisode(3, 1, 3);
    
    const season1 = createSeason(1, [ep1, ep2, ep3]);
    
    const next = resolveNextEpisode(ep1, [season1]);
    expect(next).toEqual(ep2);
    
    const next2 = resolveNextEpisode(ep2, [season1]);
    expect(next2).toEqual(ep3);
  });

  it('returns first episode of next season when at end of season', () => {
    const ep1 = createEpisode(1, 1, 1);
    const ep2 = createEpisode(2, 1, 2);
    const ep3 = createEpisode(3, 2, 1);
    const ep4 = createEpisode(4, 2, 2);
    
    const season1 = createSeason(1, [ep1, ep2]);
    const season2 = createSeason(2, [ep3, ep4]);
    
    const next = resolveNextEpisode(ep2, [season1, season2]);
    expect(next).toEqual(ep3);
  });

  it('returns null for last episode of last season', () => {
    const ep1 = createEpisode(1, 1, 1);
    const ep2 = createEpisode(2, 1, 2);
    const ep3 = createEpisode(3, 2, 1);
    const ep4 = createEpisode(4, 2, 2); // Last episode
    
    const season1 = createSeason(1, [ep1, ep2]);
    const season2 = createSeason(2, [ep3, ep4]);
    
    const next = resolveNextEpisode(ep4, [season1, season2]);
    expect(next).toBeNull();
  });

  it('handles unordered seasons input', () => {
    const ep1 = createEpisode(1, 1, 1);
    const ep2 = createEpisode(2, 1, 2);
    const ep3 = createEpisode(3, 2, 1);
    const ep4 = createEpisode(4, 2, 2);
    const ep5 = createEpisode(5, 3, 1);
    
    const season3 = createSeason(3, [ep5]);
    const season1 = createSeason(1, [ep1, ep2]);
    const season2 = createSeason(2, [ep3, ep4]);
    
    // Input seasons in wrong order
    const next = resolveNextEpisode(ep2, [season3, season1, season2]);
    expect(next).toEqual(ep3);
  });

  it('handles single episode in season', () => {
    const ep1 = createEpisode(1, 1, 1);
    const ep2 = createEpisode(2, 2, 1);
    
    const season1 = createSeason(1, [ep1]);
    const season2 = createSeason(2, [ep2]);
    
    const next = resolveNextEpisode(ep1, [season1, season2]);
    expect(next).toEqual(ep2);
  });

  it('returns null when current episode not found', () => {
    const ep1 = createEpisode(1, 1, 1);
    const ep2 = createEpisode(2, 1, 2);
    const unknownEp = createEpisode(999, 1, 99);
    
    const season1 = createSeason(1, [ep1, ep2]);
    
    const next = resolveNextEpisode(unknownEp, [season1]);
    expect(next).toBeNull();
  });

  it('returns null when current season not found', () => {
    const ep1 = createEpisode(1, 1, 1);
    const ep2 = createEpisode(2, 1, 2);
    const ep3 = createEpisode(3, 99, 1); // Season 99 doesn't exist
    
    const season1 = createSeason(1, [ep1, ep2]);
    
    const next = resolveNextEpisode(ep3, [season1]);
    expect(next).toBeNull();
  });

  it('handles empty seasons array', () => {
    const ep1 = createEpisode(1, 1, 1);
    
    const next = resolveNextEpisode(ep1, []);
    expect(next).toBeNull();
  });

  it('handles season with no episodes', () => {
    const ep1 = createEpisode(1, 1, 1);
    const ep2 = createEpisode(2, 2, 1);
    
    const season1 = createSeason(1, [ep1]);
    const season2 = createSeason(2, []); // Empty season
    const season3 = createSeason(3, [ep2]);
    
    const next = resolveNextEpisode(ep1, [season1, season2, season3]);
    expect(next).toEqual(ep2);
  });
});