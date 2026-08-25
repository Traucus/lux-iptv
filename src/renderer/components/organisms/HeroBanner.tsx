import React from 'react';
import { HeroMetadata, type HeroMetadataData } from '../molecules/HeroMetadata';

/**
 * HeroBanner organism — full-width hero section with fanart background + gradient overlay.
 * Falls back to a dark gradient if no backdrop is available (degraded mode).
 */
export interface HeroBannerProps {
  data: HeroMetadataData;
  backdropUrl?: string | null;
  onPlay?: () => void;
  onMoreInfo?: () => void;
  className?: string;
}

export function HeroBanner({
  data,
  backdropUrl,
  onPlay,
  onMoreInfo,
  className = '',
}: HeroBannerProps): React.ReactElement {
  return (
    <section
      className={`relative w-full h-[45vh] min-h-[360px] overflow-hidden rounded-2xl ${className}`}
      aria-label={`Featured: ${data.title}`}
    >
      {backdropUrl ? (
        <img
          src={backdropUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-200 via-surface-300 to-surface-400" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />

      <div className="relative z-10 h-full flex items-end p-8">
        <HeroMetadata data={data} onPlay={onPlay} onMoreInfo={onMoreInfo} />
      </div>
    </section>
  );
}

export default HeroBanner;
