import React, { useRef } from 'react';

export interface CategoryRowItem {
  id: number;
  name: string;
  cover: string | null;
  year?: number | null;
}

interface CategoryRowProps {
  title: string;
  totalCount: number;
  items: CategoryRowItem[];
  renderItem: (item: CategoryRowItem) => React.ReactNode;
  onSeeAll?: () => void;
}

/**
 * CategoryRow — horizontal scrollable row for Netflix-style catalog layout.
 * Shows a category title, a scrollable row of items, and a "Ver todo" link.
 */
export function CategoryRow({ title, totalCount, items, renderItem, onSeeAll }: CategoryRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.75;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {onSeeAll && totalCount > items.length && (
          <button
            onClick={onSeeAll}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Ver todo ({totalCount})
          </button>
        )}
      </div>

      {/* Scrollable row */}
      <div className="relative group">
        {/* Left arrow */}
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-0 bottom-0 z-10 w-10 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-l"
          aria-label="Scroll left"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Items */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item) => (
            <div key={item.id} className="flex-none w-[140px] sm:w-[160px] md:w-[180px]">
              {renderItem(item)}
            </div>
          ))}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-0 bottom-0 z-10 w-10 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-r"
          aria-label="Scroll right"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
