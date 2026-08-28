import React, { useState } from 'react';
import { Focusable } from '../atoms/Focusable';
import { Badge } from '../atoms/Badge';

/**
 * ChannelCard molecule — presentational card for live TV channels.
 * Receives channel data; onSelect triggers navigation to playback.
 * Shows placeholder letter when logo fails to load.
 */
export interface ChannelCardData {
  id: number;
  name: string;
  groupTitle: string | null;
  logo: string | null;
  currentProgram?: string | null;
}

export interface ChannelCardProps {
  channel: ChannelCardData;
  onSelect?: (channel: ChannelCardData) => void;
  className?: string;
}

export function ChannelCard({ channel, onSelect, className = '' }: ChannelCardProps): React.ReactElement {
  const [imgFailed, setImgFailed] = useState(false);
  const showLogo = channel.logo && !imgFailed;

  return (
    <Focusable
      onSelect={onSelect ? () => onSelect(channel) : undefined}
      className={`block w-56 flex-shrink-0 ${className}`}
      aria-label={`Channel ${channel.name}`}
    >
      <div className="flex flex-col gap-2 p-3 rounded-xl bg-glass-light border border-white/10 hover:border-primary-500/40 transition-colors">
        <div className="relative aspect-video bg-surface-100 rounded-lg overflow-hidden flex items-center justify-center">
          {showLogo ? (
            <img
              src={channel.logo ?? undefined}
              alt=""
              loading="lazy"
              className="w-full h-full object-contain"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="text-3xl font-bold text-gray-600">{channel.name.charAt(0).toUpperCase()}</div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-white truncate">{channel.name}</p>
          {channel.currentProgram ? (
            <p className="text-xs text-gray-400 truncate">{channel.currentProgram}</p>
          ) : channel.groupTitle ? (
            <p className="text-xs text-gray-500 truncate">{channel.groupTitle}</p>
          ) : null}
        </div>
        <Badge variant="info">LIVE</Badge>
      </div>
    </Focusable>
  );
}

export default ChannelCard;
