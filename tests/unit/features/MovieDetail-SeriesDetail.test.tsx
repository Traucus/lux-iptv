// @vitest-environment happy-dom
/**
 * MovieDetail + SeriesDetail — direct component tests covering the
 * verify-report fixes:
 *  - Fix #3: synopsis, genres, and duration render on the movie detail view.
 *  - Fix #4: the detail backdrop flows from enrichment to DetailHeader.
 *  - Fix #2: the series episode number is taken from the Episode DTO.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('react-tv-space-navigation', () => ({
  SpatialNavigationFocusableView: ({ children, ...rest }: { children: React.ReactNode }) =>
    React.createElement('div', rest, children),
  SpatialNavigationRoot: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  SpatialNavigationNode: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  SpatialNavigationView: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

import { MovieDetail } from '../../../src/renderer/features/detail/MovieDetail.tsx';
import { SeriesDetailView } from '../../../src/renderer/features/detail/SeriesDetail.tsx';
import { TMDB_IMAGE_BASE_URL } from '../../../src/renderer/lib/enrichment-merge';
import type { EnrichedCatalogItem, Episode, SeriesDetail } from '../../../src/shared/types/ipc';

beforeEach(() => {
  vi.clearAllMocks();
});

function makeMovie(overrides: Partial<EnrichedCatalogItem> = {}): EnrichedCatalogItem {
  return {
    id: 1,
    name: 'The Matrix',
    url: 'http://x',
    groupTitle: 'Sci-Fi',
    cover: null,
    year: 1999,
    enrichmentStatus: 'enriched',
    overview: null,
    posterUrl: null,
    backdropUrl: null,
    voteAverage: null,
    runtime: null,
    genres: [],
    ...overrides,
  };
}

describe('MovieDetail', () => {
  it('renders the synopsis (overview) from enrichment', () => {
    const item = makeMovie({ overview: 'A hacker discovers reality is a simulation.' });
    render(<MovieDetail item={item} />);
    expect(screen.getByTestId('movie-synopsis').textContent).toContain('hacker discovers reality');
  });

  it('renders genre tags for each enriched genre', () => {
    const item = makeMovie({ genres: ['Action', 'Science Fiction', 'Adventure'] });
    render(<MovieDetail item={item} />);
    expect(screen.getByText('Action')).toBeTruthy();
    expect(screen.getByText('Science Fiction')).toBeTruthy();
    expect(screen.getByText('Adventure')).toBeTruthy();
  });

  it('renders the duration when runtime is available', () => {
    const item = makeMovie({ runtime: 142 });
    render(<MovieDetail item={item} />);
    expect(screen.getByText('Duration')).toBeTruthy();
    expect(screen.getByText('2h 22m')).toBeTruthy();
  });

  it('omits the duration row when runtime is missing (REQ-DEGRADED-3)', () => {
    const item = makeMovie({ runtime: null });
    render(<MovieDetail item={item} />);
    expect(screen.queryByText('Duration')).toBeNull();
  });

  it('passes the backdrop URL through to DetailHeader so fanart renders', () => {
    const item = makeMovie({ backdropUrl: `${TMDB_IMAGE_BASE_URL}/w1280/backdrop.jpg` });
    render(<MovieDetail item={item} />);
    const backdropImg = document.querySelector('img[src*="backdrop.jpg"]');
    expect(backdropImg).toBeTruthy();
  });

  it('falls back to the M3U cover when no poster URL is available', () => {
    const item = makeMovie({ posterUrl: null, cover: 'http://m3u/cover.jpg' });
    render(<MovieDetail item={item} />);
    const posterImg = document.querySelector('img[src="http://m3u/cover.jpg"]');
    expect(posterImg).toBeTruthy();
  });

  it('shows the degraded badge when the item is not enriched', () => {
    const item = makeMovie({ enrichmentStatus: 'pending', overview: null, genres: [] });
    render(<MovieDetail item={item} />);
    // The badge is rendered in both the header and the metadata panel.
    expect(screen.getAllByText(/No enriched metadata available/i).length).toBeGreaterThan(0);
  });
});

describe('SeriesDetailView', () => {
  const baseEpisode: Episode = {
    id: 1,
    seriesId: 1,
    name: 'Pilot',
    url: '',
    season: 1,
    episode: 1,
    cover: null,
    addedAt: 0,
  };

  function makeSeriesDetail(overrides: Partial<SeriesDetail> = {}): SeriesDetail {
    return {
      series: {
        id: 1,
        name: 'Severance',
        url: '',
        groupTitle: null,
        cover: null,
        year: 2022,
      },
      seasons: [
        {
          seasonNumber: 1,
          episodes: [
            { ...baseEpisode, episode: 1, name: 'Good News About Hell' },
            { ...baseEpisode, id: 99, episode: 7, name: 'Defiant Jazz' },
          ],
        },
      ],
      ...overrides,
    };
  }

  it('renders the real episode number, not the SQLite primary key', () => {
    const data = makeSeriesDetail();
    render(<SeriesDetailView series={data} />);
    // "Ep. 1 — Good News About Hell" comes from ep.episode=1
    expect(screen.getByText(/Ep\. 1 — Good News About Hell/i)).toBeTruthy();
    // "Ep. 7 — Defiant Jazz" comes from ep.episode=7 (NOT ep.id=99)
    expect(screen.getByText(/Ep\. 7 — Defiant Jazz/i)).toBeTruthy();
  });

  it('renders the synopsis from the enriched view when provided', () => {
    const data = makeSeriesDetail();
    const enrichedSeries: EnrichedCatalogItem = {
      ...data.series,
      overview: 'A procedure splits the memories of office workers.',
      posterUrl: null,
      backdropUrl: null,
      voteAverage: 8.5,
      runtime: 55,
      genres: ['Drama', 'Mystery'],
    };
    render(<SeriesDetailView series={data} enrichedSeries={enrichedSeries} />);
    expect(screen.getByTestId('series-synopsis').textContent).toContain('procedure splits the memories');
  });

  it('passes the enriched backdrop URL through to DetailHeader', () => {
    const data = makeSeriesDetail();
    const enrichedSeries: EnrichedCatalogItem = {
      ...data.series,
      overview: null,
      posterUrl: null,
      backdropUrl: `${TMDB_IMAGE_BASE_URL}/w1280/series-backdrop.jpg`,
      voteAverage: null,
      runtime: null,
      genres: [],
    };
    render(<SeriesDetailView series={data} enrichedSeries={enrichedSeries} />);
    const backdropImg = document.querySelector('img[src*="series-backdrop.jpg"]');
    expect(backdropImg).toBeTruthy();
  });

  it('falls back to raw CatalogItem data when no enriched view is provided', () => {
    const data = makeSeriesDetail();
    render(<SeriesDetailView series={data} />);
    // Title still renders from the raw CatalogItem.
    expect(screen.getByText(/Severance/i)).toBeTruthy();
  });
});
