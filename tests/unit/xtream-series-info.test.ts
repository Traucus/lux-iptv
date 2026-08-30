import { describe, it, expect } from 'vitest';
import { parseXtreamSeriesId } from '../../src/main/services/xtream-client';

describe('parseXtreamSeriesId', () => {
  it('reads the series id from an Xtream series URL', () => {
    expect(parseXtreamSeriesId('http://host:8080/series/alice/secret/99.m3u8')).toBe(99);
  });

  it('returns null when the path is not Xtream series', () => {
    expect(parseXtreamSeriesId('http://cdn.example/show.m3u8')).toBeNull();
  });
});
