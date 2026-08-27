// @vitest-environment happy-dom
/**
 * Sidebar tests — verifies that dead buttons (Settings, Favorites, Search)
 * are not rendered, and that the four core navigation entries are visible.
 *
 * REQ-NAV-DEAD-BUTTONS: Buttons for features not yet implemented must be
 * hidden. Foundation scope keeps home / live / movies / series. Settings,
 * Favorites, and Search have no working routes or IPC handlers and must not
 * appear in the navigation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('react-tv-space-navigation', () => ({
  SpatialNavigationFocusableView: ({ children, onSelect, ...rest }: { children: React.ReactNode; onSelect?: () => void }) =>
    React.createElement('div', { ...rest, onClick: onSelect }, children),
  SpatialNavigationRoot: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  SpatialNavigationNode: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  SpatialNavigationView: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

import { Sidebar } from '../../../src/renderer/components/organisms/Sidebar.tsx';

beforeEach(() => {
  // happy-dom has no width APIs by default; jsdom/happy-dom renders Sidebar
  // collapsed (w-20) without the labels visible. We render expanded by
  // hovering it — but for label assertions we look at aria-label which is
  // always present regardless of expanded state.
});

describe('Sidebar — navigation entries', () => {
  it('renders Home, Live TV, Movies, Series entries', () => {
    render(<Sidebar active="home" />);
    expect(screen.getByLabelText('Home')).toBeTruthy();
    expect(screen.getByLabelText('Live TV')).toBeTruthy();
    expect(screen.getByLabelText('Movies')).toBeTruthy();
    expect(screen.getByLabelText('Series')).toBeTruthy();
  });

  it('does NOT render Settings button (dead feature)', () => {
    render(<Sidebar active="home" />);
    expect(screen.queryByLabelText('Settings')).toBeNull();
  });

  it('does NOT render Favorites button (dead feature)', () => {
    render(<Sidebar active="home" />);
    expect(screen.queryByLabelText('Favorites')).toBeNull();
  });

  it('does NOT render Search button (dead feature)', () => {
    render(<Sidebar active="home" />);
    expect(screen.queryByLabelText('Search')).toBeNull();
  });

  it('marks the active entry with data-active', () => {
    const { container } = render(<Sidebar active="movies" />);
    const items = container.querySelectorAll('[data-active]');
    expect(items).toHaveLength(1);
  });

  it('calls onSelect with the chosen section key', () => {
    const onSelect = vi.fn();
    render(<Sidebar active="home" onSelect={onSelect} />);
    // Use the Home button (click the Focusable wrapper which delegates to onSelect).
    screen.getByLabelText('Live TV').click();
    expect(onSelect).toHaveBeenCalledWith('live');
  });
});
