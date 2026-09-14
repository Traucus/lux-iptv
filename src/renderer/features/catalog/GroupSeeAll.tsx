import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Spinner } from '../../components/atoms/Spinner';
import { useCatalogList } from '../../queries/use-catalog';
import type { CatalogType } from '../../../shared/types/ipc';
import { posterFromRow, useEnrichedPosters } from './useEnrichedPosters';

function toRenderItem(
  item: { id: number; name: string; cover: string | null; year: number | null },
  posters: ReturnType<typeof useEnrichedPosters>,
): { id: number; name: string; cover: string | null; year: number | null } {
  const poster = posterFromRow(item, posters);
  return {
    id: poster.id,
    name: poster.name,
    cover: poster.posterPath,
    year: poster.year,
  };
}

export function GroupSeeAll({
  type,
  group,
  parentPath,
  renderItem,
  onSelect,
}: {
  type: CatalogType;
  group: string;
  parentPath: string;
  renderItem: (item: { id: number; name: string; cover: string | null; year: number | null }) => React.ReactNode;
  onSelect?: (id: number) => void;
}): React.ReactElement {
  const navigate = useNavigate();
  const { data, isLoading, error } = useCatalogList(type, { groupTitle: group, limit: 500 });
  const mediaType = type === 'series' ? 'tv' : type === 'movie' ? 'movie' : 'live';
  const posters = useEnrichedPosters(
    (data?.items ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      cover: item.cover,
      year: item.year,
    })),
    mediaType,
  );

  return (
    <div>
      <button
        type="button"
        className="text-sm text-gray-400 hover:text-white mb-4"
        onClick={() => navigate(parentPath)}
      >
        ← Back
      </button>
      <h1 className="text-2xl font-bold text-white mb-6">{group}</h1>
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <Spinner size="lg" label="Loading group" />
        </div>
      ) : error ? (
        <p className="text-red-400">{(error as Error).message}</p>
      ) : !data?.items.length ? (
        <p className="text-gray-400">No items in this group.</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {data.items.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelect?.(item.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') onSelect?.(item.id);
              }}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
            >
              {renderItem(toRenderItem(item, posters))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GroupSeeAll;
