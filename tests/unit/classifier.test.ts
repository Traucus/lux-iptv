import { describe, it, expect } from 'vitest';
import { classify, seriesShowTitle } from '../../src/main/services/classifier';

type ClassifierInput = {
  url: string;
  name: string;
  groupTitle?: string | null;
  tvgId?: string | null;
  streamType?: string | null;
};

describe('classifier', () => {
  describe('Stage 1: URL path check', () => {
    it('classifies /movie/ URL as movie', () => {
      expect(classify({ url: 'http://server.com/movie/123.mkv', name: 'Avatar' })).toBe('movie');
    });

    it('classifies /series/ URL as series', () => {
      expect(classify({ url: 'http://server.com/series/123.mkv', name: 'Breaking Bad' })).toBe('series');
    });

    it('classifies /live/ URL as live', () => {
      expect(classify({ url: 'http://server.com/live/123.ts', name: 'CNN' })).toBe('live');
    });
  });

  describe('Stage 2: group-title pattern matching', () => {
    it('classifies group-title="Series" as series', () => {
      expect(classify({ url: 'http://x.com/1', name: 'Show', groupTitle: 'Series' })).toBe('series');
    });

    it('classifies group-title="Diziler" as series', () => {
      expect(classify({ url: 'http://x.com/1', name: 'Show', groupTitle: 'Diziler' })).toBe('series');
    });

    it('classifies group-title="Movies" as movie', () => {
      expect(classify({ url: 'http://x.com/1', name: 'Film', groupTitle: 'Movies' })).toBe('movie');
    });

    it('classifies group-title="Filmes" as movie', () => {
      expect(classify({ url: 'http://x.com/1', name: 'Film', groupTitle: 'Filmes' })).toBe('movie');
    });

    it('classifies group-title="Radio" as radio', () => {
      expect(classify({ url: 'http://x.com/1', name: 'FM', groupTitle: 'Radio' })).toBe('radio');
    });

    it('classifies group-title="Radios" as radio', () => {
      expect(classify({ url: 'http://x.com/1', name: 'FM', groupTitle: 'Radios' })).toBe('radio');
    });
  });

  describe('Stage 3: stream type metadata', () => {
    it('classifies streamType="movie" as movie', () => {
      expect(classify({ url: 'http://x.com/1', name: 'Film', streamType: 'movie' })).toBe('movie');
    });

    it('classifies streamType="series" as series', () => {
      expect(classify({ url: 'http://x.com/1', name: 'Show', streamType: 'series' })).toBe('series');
    });

    it('classifies streamType="radio" as radio', () => {
      expect(classify({ url: 'http://x.com/1', name: 'FM', streamType: 'radio' })).toBe('radio');
    });
  });

  describe('Stage 4: IMDb ID presence', () => {
    it('classifies entry with IMDb ID as movie (default)', () => {
      expect(classify({ url: 'http://x.com/1', name: 'Avatar tt0499549' })).toBe('movie');
    });
  });

  describe('Stage 5: Name pattern analysis (SxxExx)', () => {
    it('classifies S03E07 pattern as series', () => {
      expect(classify({ url: 'http://x.com/1', name: 'Breaking.Bad.S03E07.720p' })).toBe('series');
    });

    it('classifies S01E01 pattern as series', () => {
      expect(classify({ url: 'http://x.com/1', name: 'The Office S01E01' })).toBe('series');
    });
  });

  describe('Stage 6: Default fallback', () => {
    it('defaults to live when no signals match', () => {
      expect(classify({ url: 'http://x.com/stream.ts', name: 'Some Channel' })).toBe('live');
    });

    it('defaults to live for empty group-title', () => {
      expect(classify({ url: 'http://x.com/stream.ts', name: 'Channel', groupTitle: '' })).toBe('live');
    });

    it('defaults to live for null group-title', () => {
      expect(classify({ url: 'http://x.com/stream.ts', name: 'Channel', groupTitle: null })).toBe('live');
    });
  });

  describe('Full fixture table from DOC-3 §3.2', () => {
    const fixtures: Array<{ input: ClassifierInput; expected: string }> = [
      { input: { url: 'http://server.com/movie/123.mkv', name: 'Avatar (2009)' }, expected: 'movie' },
      { input: { url: 'http://server.com/series/456.mkv', name: 'Breaking Bad' }, expected: 'series' },
      { input: { url: 'http://server.com/live/789.ts', name: 'CNN International' }, expected: 'live' },
      { input: { url: 'http://x.com/1', name: 'Film', groupTitle: 'VOD | Movies' }, expected: 'movie' },
      { input: { url: 'http://x.com/1', name: 'Show', groupTitle: 'TV Series' }, expected: 'series' },
      { input: { url: 'http://x.com/1', name: 'FM 99.9', groupTitle: 'Radio Streams' }, expected: 'radio' },
      { input: { url: 'http://x.com/1', name: 'Movie tt1234567', groupTitle: 'All' }, expected: 'movie' },
      { input: { url: 'http://x.com/1', name: 'Show.S02E10.720p', groupTitle: 'All' }, expected: 'series' },
      { input: { url: 'http://x.com/stream', name: 'Unknown Channel', groupTitle: 'General' }, expected: 'live' },
      { input: { url: 'http://x.com/1', name: 'Film', groupTitle: 'Películas' }, expected: 'movie' },
      { input: { url: 'http://x.com/1', name: 'Serie', groupTitle: 'Séries' }, expected: 'series' },
      { input: { url: 'http://x.com/1', name: 'Radyo', groupTitle: 'Radyolar' }, expected: 'radio' },
    ];

    for (const { input, expected } of fixtures) {
      it(`classifies "${input.name}" (${input.groupTitle ?? 'no group'}) as ${expected}`, () => {
        expect(classify(input)).toBe(expected);
      });
    }
  });

  describe('seriesShowTitle', () => {
    it('strips SxxExx episode tails', () => {
      expect(seriesShowTitle('7 Seeds - S01E01 - 7 S...')).toBe('7 Seeds');
      expect(seriesShowTitle('Leviathan - S01E01 - L...')).toBe('Leviathan');
    });

    it('keeps a plain show name', () => {
      expect(seriesShowTitle('El juego del calamar')).toBe('El juego del calamar');
    });
  });
});
