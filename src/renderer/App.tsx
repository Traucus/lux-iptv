import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { IngestPage } from './features/ingest/IngestPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { DetailPage } from './features/detail/DetailPage';

/**
 * Application root component.
 * Routes:
 *   /             → DashboardPage (Screen 3)
 *   /ingest       → IngestPage (Screen 2)
 *   /content/:id  → DetailPage (Screen 4)
 */
function App(): React.ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/ingest" element={<IngestPage />} />
        <Route path="/content/:id" element={<DetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
