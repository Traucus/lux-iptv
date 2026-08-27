import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Button } from '../../components/atoms/Button';
import type { CatalogType } from '../../../shared/types/ipc';

/**
 * PlayerPlaceholder — temporary landing component for /watch/:type/:id.
 *
 * The real VideoPlayer (G6, PR 5) replaces this. For now we render the
 * resolved type + id so end-to-end smoke tests can verify routing, and we
 * redirect to "/" if the type param is invalid.
 */
export interface PlayerPlaceholderProps {
  /** Override hook for tests; defaults to useParams from react-router-dom. */
  params?: { type?: string; id?: string };
  /** Override redirect target for tests. */
  redirectTo?: string;
}

const VALID_TYPES: ReadonlySet<CatalogType> = new Set(['live', 'movie', 'series', 'episode']);

function isCatalogType(value: string | undefined): value is CatalogType {
  return typeof value === 'string' && VALID_TYPES.has(value as CatalogType);
}

export function PlayerPlaceholder({ params, redirectTo = '/' }: PlayerPlaceholderProps = {}): React.ReactElement {
  const routeParams = useParams<{ type: string; id: string }>();
  const type = params?.type ?? routeParams.type;
  const id = params?.id ?? routeParams.id;

  if (!isCatalogType(type)) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <main
      className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4"
      data-testid="player-placeholder"
    >
      <div className="flex flex-col items-center gap-2">
        <p className="text-xs uppercase tracking-widest text-gray-400">Player (placeholder)</p>
        <h1 className="text-3xl font-semibold" data-testid="player-type">
          type={type}
        </h1>
        <p className="text-lg text-gray-300" data-testid="player-id">
          id={id}
        </p>
      </div>
      <p className="text-sm text-gray-500" data-testid="player-message">
        Player coming in PR 5
      </p>
      <a
        href="#/"
        className="inline-flex items-center px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
      >
        Back to home
      </a>
      {/* Suppress unused-var warning for Button — kept as a future hook for
          wiring keyboard/tv-navigation controls once the real player lands. */}
      <span hidden>
        <Button onClick={() => undefined} variant="glass" size="sm">
          Back
        </Button>
      </span>
    </main>
  );
}

export default PlayerPlaceholder;
