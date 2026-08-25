/**
 * Organism component tests.
 *
 * ContentCarousel is a client-only organism (uses react-window + state); we mock the
 * heavy deps to keep SSR-friendly assertions on the rest of the organisms.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// Mock react-tv-space-navigation before any imports that depend on it.
vi.mock('react-tv-space-navigation', () => ({
  SpatialNavigationFocusableView: ({
    children,
    className,
    onSelect,
    ...rest
  }: {
    children: React.ReactNode;
    className?: string;
    onSelect?: () => void;
    'aria-label'?: string;
  }) =>
    React.createElement(
      'div',
      { className, onClick: onSelect, role: 'button', tabIndex: 0, ...rest },
      children,
    ),
  SpatialNavigationRoot: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  SpatialNavigationNode: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  SpatialNavigationView: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

// Mock react-window with a simple Grid stub for the test environment.
vi.mock('react-window', () => ({
  Grid: ({
    columnCount,
    cellComponent: Cell,
    cellProps,
  }: {
    columnCount: number;
    cellComponent: React.ComponentType<{ ariaIndex: number; items: unknown[]; renderItem: (i: unknown, n: number) => React.ReactNode }>;
    cellProps: { items: unknown[]; renderItem: (i: unknown, n: number) => React.ReactNode };
  }) => {
    const indices = Array.from({ length: columnCount }, (_, i) => i);
    return React.createElement(
      'div',
      { 'data-testid': 'mock-grid', 'data-column-count': columnCount },
      indices.map((i) =>
        React.createElement(Cell, { key: i, ariaIndex: i, ...cellProps }),
      ),
    );
  },
}));

import { HeroBanner } from '../../../src/renderer/components/organisms/HeroBanner.tsx';
import { ContentCarousel } from '../../../src/renderer/components/organisms/ContentCarousel.tsx';
import { DetailHeader } from '../../../src/renderer/components/organisms/DetailHeader.tsx';
import { EpisodeGrid } from '../../../src/renderer/components/organisms/EpisodeGrid.tsx';

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

describe('organisms', () => {
  describe('HeroBanner', () => {
    it('renders backdrop image when provided', () => {
      const html = render(
        <HeroBanner
          data={{ title: 'Inception', year: 2010, genres: ['Action'], synopsis: 'A thief', rating: 8.8 }}
          backdropUrl="http://example.com/bg.jpg"
          onPlay={() => undefined}
          onMoreInfo={() => undefined}
        />,
      );
      expect(html).toContain('http://example.com/bg.jpg');
      expect(html).toContain('Inception');
      expect(html).toContain('Play');
      expect(html).toContain('More Info');
    });

    it('renders gradient fallback when no backdrop', () => {
      const html = render(
        <HeroBanner
          data={{ title: 'X', year: null, genres: [], synopsis: null, rating: null }}
        />,
      );
      expect(html).toContain('bg-gradient-to-br');
      expect(html).not.toContain('<img');
    });
  });

  describe('ContentCarousel', () => {
    it('renders nothing when items array is empty', () => {
      const html = render(
        <ContentCarousel
          title="Recent Movies"
          items={[]}
          renderItem={() => <div>x</div>}
        />,
      );
      expect(html).toBe('');
    });

    it('renders title and grid when items present', () => {
      const html = render(
        <ContentCarousel
          title="Recent Movies"
          items={[{ id: 1 }, { id: 2 }]}
          renderItem={(item) => <span>{String((item as { id: number }).id)}</span>}
        />,
      );
      expect(html).toContain('Recent Movies');
      expect(html).toContain('mock-grid');
      expect(html).toContain('data-column-count="2"');
    });
  });

  describe('DetailHeader', () => {
    it('renders title, year, genres and enriched badge', () => {
      const html = render(
        <DetailHeader
          title="The Matrix"
          year={1999}
          genres={['Action', 'Sci-Fi']}
          enriched
        />,
      );
      expect(html).toContain('The Matrix');
      expect(html).toContain('1999');
      expect(html).toContain('Action, Sci-Fi');
      expect(html).not.toContain('No enriched metadata');
    });

    it('shows degraded indicator when not enriched', () => {
      const html = render(
        <DetailHeader title="Raw Title" enriched={false} />,
      );
      expect(html).toContain('No enriched metadata available');
    });

    it('renders backdrop image when provided', () => {
      const html = render(
        <DetailHeader
          title="Movie"
          enriched
          backdropUrl="http://example.com/b.jpg"
        />,
      );
      expect(html).toContain('http://example.com/b.jpg');
      expect(html).toContain('blur-xl');
    });
  });

  describe('EpisodeGrid', () => {
    it('renders empty state when no episodes', () => {
      const html = render(<EpisodeGrid episodes={[]} />);
      expect(html).toContain('No episodes available');
    });

    it('renders episodes in grid', () => {
      const html = render(
        <EpisodeGrid
          episodes={[
            { id: 1, season: 1, episode: 1, name: 'Pilot', thumbnailUrl: null, durationSec: 1800, watched: false },
            { id: 2, season: 1, episode: 2, name: 'Ep2', thumbnailUrl: null, durationSec: 1800, watched: true },
          ]}
        />,
      );
      expect(html).toContain('Ep. 1 — Pilot');
      expect(html).toContain('Ep. 2 — Ep2');
      expect(html).toContain('grid grid-cols-1');
    });
  });
});
