/**
 * Molecule component tests — presentational compositions of atoms.
 * SSR-based assertions on the rendered markup.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// react-tv-space-navigation requires react-native; mock it before importing components that depend on it.
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
      {
        className,
        onClick: onSelect,
        role: 'button',
        tabIndex: 0,
        ...rest,
      },
      children,
    ),
  SpatialNavigationRoot: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  SpatialNavigationNode: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  SpatialNavigationView: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  SpatialNavigationScrollView: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

import { ChannelCard } from '../../../src/renderer/components/molecules/ChannelCard.tsx';
import { MoviePosterCard, PlaceholderArt } from '../../../src/renderer/components/molecules/MoviePosterCard.tsx';
import { SeriesPosterCard } from '../../../src/renderer/components/molecules/SeriesPosterCard.tsx';
import { EpisodeCard } from '../../../src/renderer/components/molecules/EpisodeCard.tsx';
import { HeroMetadata } from '../../../src/renderer/components/molecules/HeroMetadata.tsx';
import { CredentialFormTabs } from '../../../src/renderer/components/molecules/CredentialFormTabs.tsx';
import { ProgressOverlay } from '../../../src/renderer/components/molecules/ProgressOverlay.tsx';
import { SidebarNavItem } from '../../../src/renderer/components/molecules/SidebarNavItem.tsx';
import { SeasonTab } from '../../../src/renderer/components/molecules/SeasonTab.tsx';

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element);
}

describe('molecules', () => {
  describe('ChannelCard', () => {
    it('renders channel name and LIVE badge', () => {
      const html = render(
        <ChannelCard
          channel={{ id: 1, name: 'HBO', groupTitle: 'Premium', logo: null, currentProgram: null }}
        />,
      );
      expect(html).toContain('HBO');
      expect(html).toContain('LIVE');
    });

    it('renders current program when provided', () => {
      const html = render(
        <ChannelCard
          channel={{ id: 1, name: 'CNN', groupTitle: 'News', logo: null, currentProgram: 'Breaking News' }}
        />,
      );
      expect(html).toContain('Breaking News');
    });
  });

  describe('MoviePosterCard', () => {
    it('renders poster from URL', () => {
      const html = render(
        <MoviePosterCard
          movie={{ id: 1, name: 'Inception', year: 2010, posterPath: 'http://x/p.jpg', enriched: true }}
        />,
      );
      expect(html).toContain('Inception');
      expect(html).toContain('2010');
      expect(html).toContain('http://x/p.jpg');
    });

    it('shows placeholder letter when no poster', () => {
      const html = render(
        <MoviePosterCard
          movie={{ id: 2, name: 'Avatar', year: 2009, posterPath: null, enriched: false }}
        />,
      );
      expect(html).toContain('A');
    });
  });

  describe('SeriesPosterCard', () => {
    it('renders series title and season count', () => {
      const html = render(
        <SeriesPosterCard
          series={{ id: 1, name: 'Breaking Bad', year: 2008, posterPath: null, seasonCount: 5, enriched: true }}
        />,
      );
      expect(html).toContain('Breaking Bad');
      expect(html).toContain('5 seasons');
    });

    it('handles singular season label', () => {
      const html = render(
        <SeriesPosterCard
          series={{ id: 1, name: 'Chernobyl', year: 2019, posterPath: null, seasonCount: 1, enriched: true }}
        />,
      );
      expect(html).toContain('1 season<');
    });
  });

  describe('EpisodeCard', () => {
    it('renders episode label', () => {
      const html = render(
        <EpisodeCard
          episode={{
            id: 1,
            season: 1,
            episode: 3,
            name: 'Pilot',
            thumbnailUrl: null,
            durationSec: 1800,
            watched: false,
          }}
        />,
      );
      expect(html).toContain('Ep. 3 — Pilot');
      expect(html).toContain('30m 00s');
    });

    it('renders watched checkmark', () => {
      const html = render(
        <EpisodeCard
          episode={{
            id: 1,
            season: 1,
            episode: 1,
            name: 'A',
            thumbnailUrl: null,
            durationSec: null,
            watched: true,
          }}
        />,
      );
      expect(html).toContain('bg-primary-500');
    });
  });

  describe('HeroMetadata', () => {
    it('renders title, year, genres, synopsis', () => {
      const html = render(
        <HeroMetadata
          data={{
            title: 'Inception',
            year: 2010,
            genres: ['Action', 'Sci-Fi'],
            synopsis: 'A thief who steals corporate secrets.',
            rating: 8.8,
          }}
          onPlay={() => undefined}
          onMoreInfo={() => undefined}
        />,
      );
      expect(html).toContain('Inception');
      expect(html).toContain('2010');
      expect(html).toContain('Action, Sci-Fi');
      expect(html).toContain('8.8');
      expect(html).toContain('A thief');
      expect(html).toContain('Play');
      expect(html).toContain('More Info');
    });

    it('hides year/rating when missing', () => {
      const html = render(
        <HeroMetadata
          data={{ title: 'X', year: null, genres: [], synopsis: null, rating: null }}
        />,
      );
      expect(html).toContain('X');
      expect(html).not.toContain('★');
    });
  });

  describe('CredentialFormTabs', () => {
    it('marks active tab', () => {
      const html = render(
        <CredentialFormTabs active="xtream" onChange={() => undefined} />,
      );
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('Xtream Codes API');
      expect(html).toContain('M3U Playlist URL');
      expect(html).toContain('bg-primary-500');
    });

    it('renders both tabs', () => {
      const html = render(
        <CredentialFormTabs active="m3u" onChange={() => undefined} />,
      );
      expect(html).toContain('id="tab-xtream"');
      expect(html).toContain('id="tab-m3u"');
    });
  });

  describe('ProgressOverlay', () => {
    it('renders phase and counts during ingest', () => {
      const html = render(
        <ProgressOverlay
          phase="PERSIST"
          percent={42}
          counts={{ live: 100, movies: 250, series: 30, radio: 0, total: 380 }}
          onCancel={() => undefined}
        />,
      );
      expect(html).toContain('Processing IPTV Playlist');
      expect(html).toContain('role="progressbar"');
      expect(html).toContain('100');
      expect(html).toContain('250');
      expect(html).toContain('30');
      expect(html).toContain('Cancel');
    });

    it('renders DONE message with no cancel button', () => {
      const html = render(
        <ProgressOverlay
          phase="DONE"
          percent={100}
          counts={{ live: 0, movies: 0, series: 0, radio: 0, total: 0 }}
        />,
      );
      expect(html).toContain('Ingestion Complete!');
      expect(html).not.toContain('Cancel');
    });

    it('renders error state with Retry button', () => {
      const html = render(
        <ProgressOverlay
          phase="ERROR"
          percent={10}
          counts={{ live: 0, movies: 0, series: 0, radio: 0, total: 0 }}
          errorMessage="Network unreachable"
          onRetry={() => undefined}
        />,
      );
      expect(html).toContain('Ingestion Failed');
      expect(html).toContain('Network unreachable');
      expect(html).toContain('Retry');
    });
  });

  describe('SidebarNavItem', () => {
    it('renders label when expanded', () => {
      const html = render(
        <SidebarNavItem
          icon={<span>H</span>}
          label="Home"
          expanded
          active
        />,
      );
      expect(html).toContain('Home');
      expect(html).toContain('data-active');
      expect(html).toContain('bg-primary-500/15');
    });

    it('hides label when collapsed', () => {
      const html = render(
        <SidebarNavItem icon={<span>H</span>} label="Home" expanded={false} />,
      );
      expect(html).not.toContain('>Home<');
    });
  });

  describe('SeasonTab', () => {
    it('marks active tab', () => {
      const html = render(<SeasonTab seasonNumber={2} active episodeCount={10} />);
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('Season 2');
      expect(html).toContain('(10)');
      expect(html).toContain('bg-primary-500');
    });

    it('renders inactive tab', () => {
      const html = render(<SeasonTab seasonNumber={1} />);
      expect(html).toContain('aria-selected="false"');
    });
  });

  describe('PlaceholderArt', () => {
    it('shows first letter capitalized', () => {
      const html = render(<PlaceholderArt label="avengers" />);
      expect(html).toContain('A');
    });

    it('falls back to ? for empty label', () => {
      const html = render(<PlaceholderArt label="" />);
      expect(html).toContain('?');
    });
  });
});
