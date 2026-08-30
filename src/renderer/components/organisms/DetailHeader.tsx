import React from 'react';
import { Badge } from '../atoms/Badge';

/**
 * DetailHeader — top section of the detail view with backdrop + blurred overlay + title block.
 * Falls back to a dark gradient if no backdrop image.
 */
export interface DetailHeaderProps {
  title: string;
  subtitle?: string | null;
  year?: number | null;
  genres?: string[];
  backdropUrl?: string | null;
  enriched: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function DetailHeader({
  title,
  subtitle,
  year,
  genres = [],
  backdropUrl,
  enriched,
  children,
  className = '',
}: DetailHeaderProps): React.ReactElement {
  return (
    <header
      className={`relative w-full h-[28vh] min-h-[180px] max-h-[280px] overflow-hidden ${className}`}
      aria-label={title}
    >
      {backdropUrl ? (
        <>
          <img
            src={backdropUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-top"
            loading="eager"
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-200 via-surface-300 to-surface-400" />
      )}

      <div className="absolute inset-0 bg-black/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

      <div className="relative z-10 h-full flex flex-col justify-end p-8 gap-4">
        <div className="flex flex-col gap-2 max-w-3xl">
          <h1 className="text-display-lg font-bold text-white leading-tight">{title}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-300">
            {year ? <span>{year}</span> : null}
            {subtitle ? <span>· {subtitle}</span> : null}
            {genres.length > 0 ? <span>· {genres.slice(0, 3).join(', ')}</span> : null}
          </div>
          {!enriched ? (
            <Badge variant="warning">No enriched metadata available</Badge>
          ) : null}
        </div>
        {children ? <div className="flex items-center gap-3">{children}</div> : null}
      </div>
    </header>
  );
}

export default DetailHeader;
