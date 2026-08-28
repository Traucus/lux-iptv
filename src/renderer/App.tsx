import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { IngestPage } from './features/ingest/IngestPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { LivePage } from './features/live/LivePage';
import { MoviesPage } from './features/movies/MoviesPage';
import { SeriesPage } from './features/series/SeriesPage';
import { DetailPage } from './features/detail/DetailPage';
import { PlayerPage } from './features/player/PlayerPage';
import { IngestProgressHost } from './features/ingest/IngestProgressHost';

/**
 * Application root component.
 *
 * REQ-ROUTER-1: HashRouter (not BrowserRouter) so deep links resolve under
 * the `file://` protocol used by packaged Electron builds.
 *
 * Routes:
 *   /                  → DashboardPage (Screen 3)
 *   /ingest            → IngestPage (Screen 2)
 *   /live              → LivePage
 *   /movies            → MoviesPage
 *   /series            → SeriesPage
 *   /content/:id       → DetailPage (Screen 4)
 *   /watch/:type/:id   → PlayerPage
 */
function App(): React.ReactElement {
  return (
    <HashRouter>
      <IngestProgressHost />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/ingest" element={<IngestPage />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/movies" element={<MoviesPage />} />
        <Route path="/series" element={<SeriesPage />} />
        <Route path="/content/:id" element={<DetailPage />} />
        <Route path="/watch/:type/:id" element={<PlayerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
