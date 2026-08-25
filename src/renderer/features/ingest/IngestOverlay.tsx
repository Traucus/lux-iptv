import React from 'react';
import { ProgressOverlay, type IngestCounts, type IngestPhase } from '../../components/molecules/ProgressOverlay';

export interface IngestOverlayProps {
  phase: IngestPhase;
  percent: number;
  counts: IngestCounts;
  errorMessage?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
}

/**
 * IngestOverlay — feature-level wrapper around ProgressOverlay.
 * Renders nothing when phase is null/undefined.
 */
export function IngestOverlay({
  phase,
  percent,
  counts,
  errorMessage,
  onRetry,
  onCancel,
}: IngestOverlayProps): React.ReactElement | null {
  if (!phase) return null;
  return (
    <ProgressOverlay
      phase={phase}
      percent={percent}
      counts={counts}
      errorMessage={errorMessage}
      onRetry={onRetry}
      onCancel={onCancel}
    />
  );
}

export default IngestOverlay;
