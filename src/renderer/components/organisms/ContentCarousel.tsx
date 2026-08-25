import React from 'react';
import { Grid } from 'react-window';

/**
 * ContentCarousel organism — virtualized horizontal carousel using react-window Grid.
 *
 * Renders only ~visible cards in the DOM (column-based virtualization).
 * Hides itself entirely if items array is empty.
 */
export interface ContentCarouselProps<T> {
  title: string;
  items: T[];
  renderItem: (item: T, index: number) => React.ReactElement;
  cardWidth?: number;
  cardHeight?: number;
  className?: string;
  emptyClassName?: string;
}

const DEFAULT_CARD_WIDTH = 200;
const DEFAULT_CARD_HEIGHT = 300;

interface CarouselCellExtraProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactElement;
  cardWidth: number;
}

export function ContentCarousel<T>({
  title,
  items,
  renderItem,
  cardWidth = DEFAULT_CARD_WIDTH,
  cardHeight = DEFAULT_CARD_HEIGHT,
  className = '',
}: ContentCarouselProps<T>): React.ReactElement | null {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className={`w-full ${className}`} aria-label={title}>
      <h2 className="text-xl font-semibold text-white mb-3 px-4">{title}</h2>
      <div className="relative">
        <Grid<CarouselCellExtraProps<T>>
          cellComponent={CarouselCell as React.ComponentType<{ ariaIndex: number; items: T[]; renderItem: (i: T, n: number) => React.ReactElement; cardWidth: number; style: React.CSSProperties }>}
          cellProps={{ items, renderItem, cardWidth }}
          columnCount={items.length}
          columnWidth={cardWidth + 16}
          rowCount={1}
          rowHeight={cardHeight + 16}
          style={{ height: cardHeight + 24, width: '100%' }}
          overscanCount={5}
        />
      </div>
    </section>
  );
}

function CarouselCell<T>({
  items,
  renderItem,
  cardWidth,
  ariaIndex,
  style,
}: {
  ariaIndex: number;
  items: T[];
  renderItem: (item: T, index: number) => React.ReactElement;
  cardWidth: number;
  style: React.CSSProperties;
}): React.ReactElement {
  const item = items[ariaIndex];
  if (!item) return <div style={style} />;
  return (
    <div
      style={{ ...style, paddingInline: 8, boxSizing: 'border-box' }}
      data-aria-index={ariaIndex}
    >
      <div style={{ width: cardWidth }}>{renderItem(item, ariaIndex)}</div>
    </div>
  );
}

export default ContentCarousel;
