// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { render, screen, act } from '@testing-library/react';

const progressListeners: Array<(p: Record<string, unknown>) => void> = [];

const mockApi = vi.hoisted(() => ({
  ingest: {
    onProgress: (cb: (p: Record<string, unknown>) => void) => {
      progressListeners.push(cb);
      return () => {
        const i = progressListeners.indexOf(cb);
        if (i >= 0) progressListeners.splice(i, 1);
      };
    },
  },
}));

vi.mock('../../../src/renderer/lib/api', () => ({
  createLuxAPI: () => mockApi,
}));

import { IngestProgressHost } from '../../../src/renderer/features/ingest/IngestProgressHost';

function renderHost() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <IngestProgressHost />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  progressListeners.length = 0;
});

describe('IngestProgressHost', () => {
  it('renders nothing until progress arrives', () => {
    renderHost();
    expect(screen.queryByRole('dialog', { name: /ingestion progress/i })).toBeNull();
  });

  it('shows live counts from ingest:progress and stays mounted', () => {
    renderHost();
    act(() => {
      progressListeners[0]?.({
        phase: 'PERSIST',
        live: 10,
        movies: 20,
        series: 5,
        radio: 0,
        total: 35,
      });
    });
    expect(screen.getByRole('dialog', { name: /ingestion progress/i })).toBeTruthy();
    expect(screen.getByText('Processing IPTV Playlist…')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });
});
