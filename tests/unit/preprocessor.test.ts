import { describe, it, expect } from 'vitest';
import { preprocess } from '../../src/renderer/services/preprocessor';

describe('preprocessor', () => {
  describe('IMDb ID extraction (Regex 1)', () => {
    it('extracts tt + 7 digits', () => {
      const result = preprocess('Avatar (2009) [1080p] tt0499549.mkv');
      expect(result.imdbId).toBe('tt0499549');
    });

    it('extracts tt + 8 digits', () => {
      const result = preprocess('Movie tt12345678 720p');
      expect(result.imdbId).toBe('tt12345678');
    });

    it('returns null when no IMDb ID present', () => {
      const result = preprocess('Some Channel Name');
      expect(result.imdbId).toBeNull();
    });
  });

  describe('Year extraction (Regex 2)', () => {
    it('extracts year from parentheses', () => {
      const result = preprocess('Avatar (2009) [1080p].mkv');
      expect(result.year).toBe(2009);
    });

    it('extracts 4-digit year', () => {
      const result = preprocess('Movie 1999 BluRay');
      expect(result.year).toBe(1999);
    });

    it('returns null when no year present', () => {
      const result = preprocess('Some.Channel.Name');
      expect(result.year).toBeNull();
    });
  });

  describe('Season/Episode extraction (Regex 3)', () => {
    it('extracts S03E07', () => {
      const result = preprocess('Breaking.Bad.S03E07.720p.HDTV');
      expect(result.season).toBe(3);
      expect(result.episode).toBe(7);
    });

    it('extracts S01E01', () => {
      const result = preprocess('The.Office.S01E01.Pilot');
      expect(result.season).toBe(1);
      expect(result.episode).toBe(1);
    });

    it('extracts S12E25', () => {
      const result = preprocess('Show.S12E25.720p');
      expect(result.season).toBe(12);
      expect(result.episode).toBe(25);
    });

    it('returns null season/episode when not present', () => {
      const result = preprocess('Avatar (2009)');
      expect(result.season).toBeNull();
      expect(result.episode).toBeNull();
    });
  });

  describe('Noise stripping (Regex 4)', () => {
    it('strips quality tags', () => {
      const result = preprocess('Avatar (2009) [1080p] [BluRay]');
      expect(result.cleanTitle).not.toContain('1080p');
      expect(result.cleanTitle).not.toContain('BluRay');
    });

    it('strips codec tags', () => {
      const result = preprocess('Movie.2020.x264.AC3.DVDRip');
      expect(result.cleanTitle).not.toContain('x264');
      expect(result.cleanTitle).not.toContain('AC3');
      expect(result.cleanTitle).not.toContain('DVDRip');
    });

    it('strips release group tags', () => {
      const result = preprocess('Movie (2020) [YTS.MX]');
      expect(result.cleanTitle).not.toContain('YTS');
    });

    it('strips [4K], HD, etc.', () => {
      const result = preprocess('Channel [4K] [HD] [UHD]');
      expect(result.cleanTitle).not.toContain('4K');
      expect(result.cleanTitle).not.toContain('HD');
      expect(result.cleanTitle).not.toContain('UHD');
    });

    it('strips dots used as spaces', () => {
      const result = preprocess('Breaking.Bad.S03E07.720p.HDTV');
      expect(result.cleanTitle).toContain('Breaking Bad');
    });
  });

  describe('Full fixture table from DOC-8 §8.3', () => {
    const fixtures: Array<{ input: string; expected: Partial<ReturnType<typeof preprocess>> }> = [
      {
        input: 'Avatar (2009) [1080p] tt0499549.mkv',
        expected: { imdbId: 'tt0499549', year: 2009, cleanTitle: 'Avatar' },
      },
      {
        input: 'Breaking.Bad.S03E07.720p.HDTV',
        expected: { season: 3, episode: 7, cleanTitle: 'Breaking Bad' },
      },
      {
        input: 'The Matrix (1999) [BluRay] [1080p] tt0133093',
        expected: { imdbId: 'tt0133093', year: 1999 },
      },
      {
        input: 'Game.of.Thrones.S08E06.1080p.WEB.h264-TBS',
        expected: { season: 8, episode: 6 },
      },
      {
        input: 'Inception.2010.1080p.BluRay.x264.DTS-FGT',
        expected: { year: 2010 },
      },
      {
        input: 'CNN International [HD]',
        expected: { cleanTitle: 'CNN International' },
      },
      {
        input: 'Movie [4K] [UHD] [HDR]',
        expected: { cleanTitle: 'Movie' },
      },
      {
        input: 'Show S01E01 Pilot',
        expected: { season: 1, episode: 1 },
      },
      {
        input: 'Film (2020) [WEB-DL] [AAC] [x265]',
        expected: { year: 2020 },
      },
      {
        input: 'Serie Espanola S02E10 720p',
        expected: { season: 2, episode: 10 },
      },
      {
        input: 'Radio Nacional',
        expected: { cleanTitle: 'Radio Nacional' },
      },
      {
        input: 'Documentary (2018) [720p] [BluRay] tt6123456',
        expected: { imdbId: 'tt6123456', year: 2018 },
      },
      {
        input: 'Channel.Name.With.Dots',
        expected: { cleanTitle: 'Channel Name With Dots' },
      },
      {
        input: 'Movie.2021.REMUX.1080p.AVC.DTS-HD.MA',
        expected: { year: 2021 },
      },
      {
        input: 'TV.Show.S10E05.Episode.Title.720p',
        expected: { season: 10, episode: 5 },
      },
    ];

    for (const { input, expected } of fixtures) {
      it(`preprocesses "${input}"`, () => {
        const result = preprocess(input);
        for (const [key, value] of Object.entries(expected)) {
          if (value !== undefined) {
            expect(result[key as keyof typeof result]).toBe(value);
          }
        }
      });
    }
  });
});
