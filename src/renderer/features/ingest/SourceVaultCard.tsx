import React from 'react';
import { Button } from '../../components/atoms/Button';
import type { IngestSource } from '../../../shared/types/ipc';

const SOURCE_LABEL: Record<IngestSource, string> = {
  xtream: 'Xtream Codes API',
  m3u: 'M3U Playlist URL',
};

export interface SourceVaultCardProps {
  listName: string;
  source: IngestSource;
  host?: string;
  onReplace: () => void;
}

export function SourceVaultCard({ listName, source, host, onReplace }: SourceVaultCardProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-display-sm font-bold text-white">{listName}</h1>
        <p className="text-gray-400">{SOURCE_LABEL[source]}</p>
        {host ? <p className="text-gray-300 text-sm">{host}</p> : null}
      </div>
      <Button type="button" variant="glass" onClick={onReplace}>
        Replace source
      </Button>
    </div>
  );
}

export default SourceVaultCard;
