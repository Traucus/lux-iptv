/**
 * Development/E2E shim for react-tv-space-navigation.
 *
 * The real package requires react-native (TV platforms). For non-TV builds
 * (Vite dev server, browser E2E), we provide a thin DOM-compatible wrapper
 * that emits ordinary focusable divs.
 *
 * In the Electron production build, the alias is removed and the real library
 * is used via the @vitejs/plugin-react tree.
 */
import React from 'react';

interface ViewProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onSelect?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  ['aria-label']?: string;
  role?: string;
  tabIndex?: number;
  viewProps?: { className?: string };
  [key: string]: unknown;
}

function passthrough<T extends keyof JSX.IntrinsicElements>(tag: T) {
  return function Shim(props: ViewProps): React.ReactElement {
    const { viewProps, children, ...rest } = props;
    return React.createElement(tag, { ...viewProps, ...rest }, children);
  };
}

export const SpatialNavigationRoot = passthrough('div');
export const SpatialNavigationNode = passthrough('div');
export const SpatialNavigationView = passthrough('div');
export const SpatialNavigationScrollView = passthrough('div');
export const SpatialNavigationVirtualizedList = passthrough('div');
export const SpatialNavigationVirtualizedGrid = passthrough('div');
export const SpatialNavigationFocusableView = passthrough('div');
export const SpatialNavigationNodeRef = null;
export const SpatialNavigationVirtualizedListRef = null;

export function useSpatialNavigatorFocusableAccessibilityProps(): Record<string, unknown> {
  return {};
}

export function useLockSpatialNavigation(): { unlock: () => void } {
  return { unlock: () => undefined };
}

export const DefaultFocus = passthrough('div');

export const Directions = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
} as const;

export const SpatialNavigation = {
  configureRemoteControl: (): void => undefined,
};

export const SpatialNavigationDeviceTypeProvider = passthrough('div');

export default {
  SpatialNavigationRoot,
  SpatialNavigationNode,
  SpatialNavigationView,
  SpatialNavigationScrollView,
  SpatialNavigationVirtualizedList,
  SpatialNavigationVirtualizedGrid,
  SpatialNavigationFocusableView,
  DefaultFocus,
  SpatialNavigation,
  Directions,
};
