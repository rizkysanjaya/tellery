/**
 * =============================================================================
 * Module: frontend/src/components/TimelineGrid.tsx
 * Purpose: Chronological timeline section with sticky date headers, responsive grid,
 *          virtual windowing for 100,000+ item scalability, keyset cursor infinite scroll,
 *          contextual empty states, per-section select-all toggles, chronological
 *          date-jump scrubber bar, dense grid ergonomics, and natural aspect masonry.
 * Used by: frontend/src/App.tsx, frontend/src/components/FavoritesView.tsx
 * Dependencies: frontend/src/types.ts, frontend/src/components/MediaCard.tsx,
 *               frontend/src/components/MediaListItem.tsx, frontend/src/components/TimelineDateScrubber.tsx, lucide-react
 * Public Members: TimelineGrid
 * Side Effects: Dispatches media item click, selection toggle, favorite toggle, infinite scroll triggers, and context menu events.
 * =============================================================================
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  FolderOpen,
} from "lucide-react";
import { DisplayLayout, MediaItem, SortOption, TimelineGroup } from "../types";
import { MediaCard } from "./MediaCard";
import { MediaListItem } from "./MediaListItem";
import { TimelineDateScrubber } from "./TimelineDateScrubber";

function useResponsiveColumns(): number {
  const [columnCount, setColumnCount] = useState<number>(() => {
    if (typeof window === "undefined") return 4;
    const w = window.innerWidth;
    if (w >= 1280) return 6;
    if (w >= 1024) return 5;
    if (w >= 768) return 4;
    if (w >= 640) return 3;
    return 2;
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      let next = 2;
      if (w >= 1280) next = 6;
      else if (w >= 1024) next = 5;
      else if (w >= 768) next = 4;
      else if (w >= 640) next = 3;
      setColumnCount((prev) => (prev !== next ? next : prev));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return columnCount;
}

interface WindowedSectionProps {
  id: string;
  itemCount: number;
  layout: DisplayLayout;
  columnCount: number;
  children: React.ReactNode;
}

/**
 * High-performance virtual windowing container for 100,000+ items.
 * Unmounts off-screen DOM nodes beyond a 1000px overscan boundary while
 * preserving exact placeholder scroll height to ensure zero layout jumps.
 */
const WindowedSection: React.FC<WindowedSectionProps> = ({
  id,
  itemCount,
  layout,
  columnCount,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const heightRef = useRef<number>(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        } else {
          if (el.offsetHeight > 0) {
            heightRef.current = el.offsetHeight;
          }
          // Only virtualize away if the group has more than 8 items to prevent tiny jumps
          if (itemCount > 8) {
            setIsVisible(false);
          }
        }
      },
      {
        rootMargin: "1000px 0px 1000px 0px",
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [itemCount]);

  const estimatedHeight = heightRef.current > 0
    ? heightRef.current
    : Math.max(120, Math.ceil(itemCount / (layout === "list" ? 1 : columnCount)) * (layout === "list" ? 48 : layout === "dense" ? 100 : 200) + 60);

  return (
    <div
      ref={containerRef}
      id={id}
      style={!isVisible ? { minHeight: `${estimatedHeight}px` } : undefined}
      className="scroll-mt-24"
    >
      {isVisible ? (
        children
      ) : (
        <div style={{ height: `${estimatedHeight}px` }} className="w-full pointer-events-none" aria-hidden="true" />
      )}
    </div>
  );
};

interface TimelineGridProps {
  groups: TimelineGroup[];
  selectedIds: Set<number>;
  searchQuery?: string;
  onClearSearch?: () => void;
  activeFolderName?: string;
  emptyContextLabel?: string;
  layout?: DisplayLayout;
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  batterySaver?: boolean;
  onSelectMedia: (item: MediaItem) => void;
  onToggleSelect: (id: number, e?: React.MouseEvent) => void;
  onSelectAllInGroup: (ids: number[]) => void;
  onDeselectAllInGroup: (ids: number[]) => void;
  onContextMenu: (e: React.MouseEvent, item: MediaItem) => void;
  onToggleFavorite?: (id: number, isFavorite: boolean) => void;
  loading: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export const TimelineGrid: React.FC<TimelineGridProps> = ({
  groups,
  selectedIds,
  searchQuery,
  onClearSearch,
  activeFolderName,
  emptyContextLabel,
  layout = "grid",
  sortBy = "date_desc",
  onSortChange,
  batterySaver = false,
  onSelectMedia,
  onToggleSelect,
  onSelectAllInGroup,
  onDeselectAllInGroup,
  onContextMenu,
  onToggleFavorite,
  loading,
  onLoadMore,
  hasMore,
  isLoadingMore,
}) => {
  const isSelectionMode = selectedIds.size > 0;
  const columnCount = useResponsiveColumns();

  // 100k+ Infinite Scroll Sentinel Observer
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !onLoadMore || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      {
        rootMargin: "600px",
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, isLoadingMore]);

  const toggleSort = (column: "name" | "date" | "size") => {
    if (!onSortChange) return;
    if (column === "name") {
      onSortChange(sortBy === "name_asc" ? "name_desc" : "name_asc");
    } else if (column === "date") {
      onSortChange(sortBy === "date_desc" ? "date_asc" : "date_desc");
    } else if (column === "size") {
      onSortChange(sortBy === "size_desc" ? "size_asc" : "size_desc");
    }
  };

  // 1. Initial or Search Loading State (when no groups are ready to display yet)
  if (loading && groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-4 animate-in fade-in duration-200">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-on-surface-variant font-medium">Loading media items...</p>
      </div>
    );
  }

  // 2. Empty State
  if (!loading && groups.length === 0) {
    const isSearchActive = Boolean(searchQuery && searchQuery.trim());

    // Contextual Empty State for Search Queries
    if (isSearchActive) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4 animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-center text-on-surface-variant/40 mb-4 shadow-sm">
            <Search className="w-8 h-8" />
          </div>
          <h3 className="text-headline-md font-bold text-on-surface tracking-tight">
            No media found
          </h3>
          <p className="text-body-sm text-on-surface-variant max-w-md mt-1.5 leading-relaxed">
            {activeFolderName ? (
              <>
                No media matching <span className="font-semibold text-primary font-mono">"{searchQuery?.trim()}"</span> inside album <span className="font-semibold text-on-surface">"{activeFolderName}"</span>
              </>
            ) : (
              <>
                No media matching <span className="font-semibold text-primary font-mono">"{searchQuery?.trim()}"</span> {emptyContextLabel || "in your vault"}
              </>
            )}
          </p>
          {onClearSearch && (
            <button
              onClick={onClearSearch}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface hover:text-primary rounded-lg text-xs font-semibold border border-outline-variant/20 cursor-pointer transition-all active:scale-95 shadow-sm"
            >
              <X className="w-3.5 h-3.5" />
              <span>Clear Search</span>
            </button>
          )}
        </div>
      );
    }

    // Contextual Empty State for Empty Albums
    if (activeFolderName) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center px-4 animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-center text-on-surface-variant/40 mb-4 shadow-sm">
            <FolderOpen className="w-8 h-8" />
          </div>
          <h3 className="text-headline-md font-bold text-on-surface tracking-tight">
            Album is empty
          </h3>
          <p className="text-body-sm text-on-surface-variant max-w-sm mt-1.5 leading-relaxed">
            Drag and drop media into <span className="font-semibold text-on-surface">"{activeFolderName}"</span>, or use the 3-dots menu on any photo to add it here.
          </p>
        </div>
      );
    }

    // Default Empty Vault State
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center px-4 animate-in fade-in duration-200">
        <div className="w-16 h-16 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-center text-on-surface-variant/50 mb-5 shadow-sm">
          <ImageIcon className="w-8 h-8 opacity-60" />
        </div>
        <h3 className="text-headline-md font-semibold text-on-surface tracking-tight">No media in vault</h3>
        <p className="text-body-sm text-on-surface-variant max-w-sm mt-1.5 leading-relaxed">
          Upload media directly using the button above or sync local folders via the CLI:
        </p>
        <code className="mt-4 px-3.5 py-2 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-label-md text-primary font-mono select-all">
          python -m src.cli.import_folder "D:\Pictures"
        </code>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20 relative">
      {/* Apple/Google Photos-style Chronological Date-Jump Scrubber */}
      {groups.length > 1 && <TimelineDateScrubber groups={groups} />}

      {groups.map((group) => {
        const groupItemIds = group.items.map((i) => i.id);
        const allSelected =
          groupItemIds.length > 0 &&
          groupItemIds.every((id) => selectedIds.has(id));
        const someSelected = groupItemIds.some((id) => selectedIds.has(id));

        return (
          <WindowedSection
            key={group.period_key}
            id={`timeline-group-${group.period_key}`}
            itemCount={group.items.length}
            layout={layout}
            columnCount={columnCount}
          >
            <section className="space-y-3.5">
            {/* Sleek Apple Pro Sticky Date Header */}
            <div className="sticky top-[60px] sm:top-[64px] z-20 py-2 bg-background/90 backdrop-blur-md">
              <div className="flex items-center justify-between w-full px-1 group/header">
                <div className="flex items-baseline gap-2.5 min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-on-surface tracking-tight truncate">
                    {group.period || group.period_title || "Unknown Date"}
                  </h2>
                  <span className="text-xs text-on-surface-variant font-medium shrink-0">
                    {group.items.length} {group.items.length === 1 ? "item" : "items"}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Section Select All / Deselect All Toggle */}
                  <button
                    onClick={() => {
                      if (allSelected) {
                        onDeselectAllInGroup(groupItemIds);
                      } else {
                        onSelectAllInGroup(groupItemIds);
                      }
                    }}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                      allSelected
                        ? "text-primary bg-primary/10"
                        : "text-on-surface-variant opacity-0 group-hover/header:opacity-100 hover:text-on-surface hover:bg-white/[0.04]"
                    } ${isSelectionMode || someSelected ? "!opacity-100" : ""}`}
                    title={
                      allSelected
                        ? "Deselect all in this section"
                        : "Select all in this section"
                    }
                  >
                    <span>{allSelected ? "Deselect All" : "Select All"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Layout Rendering Variants */}
            {layout === "list" ? (
              /* Detailed Table/List View */
              <div className="space-y-2">
                {/* Interactive Clickable List Header with precise column alignment */}
                <div className="hidden sm:flex items-center justify-between px-4 py-2.5 text-[13px] font-bold text-on-surface-variant uppercase tracking-wider select-none border-b border-outline-variant/15">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <span className="w-6 shrink-0" />
                    <span className="w-14 shrink-0 text-center">Preview</span>
                    <button
                      onClick={() => toggleSort("name")}
                      className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer"
                    >
                      <span>File Name</span>
                      {sortBy.startsWith("name") &&
                        (sortBy === "name_asc" ? (
                          <ArrowUp className="w-4 h-4 text-primary" />
                        ) : (
                          <ArrowDown className="w-4 h-4 text-primary" />
                        ))}
                    </button>
                  </div>

                  <div className="flex items-center gap-4 sm:gap-6 text-right shrink-0">
                    <button
                      onClick={() => toggleSort("date")}
                      className="w-32 flex items-center justify-end gap-1.5 hover:text-primary transition-colors cursor-pointer"
                    >
                      <span>Date Taken</span>
                      {sortBy.startsWith("date") &&
                        (sortBy === "date_asc" ? (
                          <ArrowUp className="w-4 h-4 text-primary" />
                        ) : (
                          <ArrowDown className="w-4 h-4 text-primary" />
                        ))}
                    </button>
                    <span className="hidden md:inline w-32 text-right">Dimensions</span>
                    <button
                      onClick={() => toggleSort("size")}
                      className="w-24 flex items-center justify-end gap-1.5 hover:text-primary transition-colors cursor-pointer"
                    >
                      <span>Size</span>
                      {sortBy.startsWith("size") &&
                        (sortBy === "size_asc" ? (
                          <ArrowUp className="w-4 h-4 text-primary" />
                        ) : (
                          <ArrowDown className="w-4 h-4 text-primary" />
                        ))}
                    </button>
                    <span className="w-8"></span>
                  </div>
                </div>

                <div className="space-y-2">
                  {group.items.map((item) => (
                    <MediaListItem
                      key={item.id}
                      item={item}
                      isSelected={selectedIds.has(item.id)}
                      isSelectionMode={isSelectionMode}
                      selectedIds={selectedIds}
                      batterySaver={batterySaver}
                      onClick={() => onSelectMedia(item)}
                      onToggleSelect={onToggleSelect}
                      onContextMenu={onContextMenu}
                    />
                  ))}
                </div>
              </div>
            ) : layout === "dense" ? (
              /* Dense High-Capacity Grid */
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5 sm:gap-2">
                {group.items.map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    isSelected={selectedIds.has(item.id)}
                    isSelectionMode={isSelectionMode}
                    selectedIds={selectedIds}
                    isDense={true}
                    batterySaver={batterySaver}
                    onClick={() => onSelectMedia(item)}
                    onToggleSelect={onToggleSelect}
                    onToggleFavorite={onToggleFavorite}
                    onContextMenu={onContextMenu}
                  />
                ))}
              </div>
            ) : layout === "masonry" ? (
              /* Natural Aspect-Ratio Showcase Grid (Ordered strictly Left-to-Right) */
              (() => {
                const columns = Array.from({ length: columnCount }, () => [] as MediaItem[]);
                group.items.forEach((item, idx) => {
                  columns[idx % columnCount].push(item);
                });

                return (
                  <div className="flex gap-2 sm:gap-2.5 items-start">
                    {columns.map((colItems, colIdx) => (
                      <div key={colIdx} className="flex-1 flex flex-col gap-2 sm:gap-2.5 min-w-0">
                        {colItems.map((item) => (
                          <MediaCard
                            key={item.id}
                            item={item}
                            isSelected={selectedIds.has(item.id)}
                            isSelectionMode={isSelectionMode}
                            selectedIds={selectedIds}
                            aspectMode="natural"
                            batterySaver={batterySaver}
                            onClick={() => onSelectMedia(item)}
                            onToggleSelect={onToggleSelect}
                            onToggleFavorite={onToggleFavorite}
                            onContextMenu={onContextMenu}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : (
              /* Standard Square Responsive Grid */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-2.5">
                {group.items.map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    isSelected={selectedIds.has(item.id)}
                    isSelectionMode={isSelectionMode}
                    selectedIds={selectedIds}
                    batterySaver={batterySaver}
                    onClick={() => onSelectMedia(item)}
                    onToggleSelect={onToggleSelect}
                    onToggleFavorite={onToggleFavorite}
                    onContextMenu={onContextMenu}
                  />
                ))}
              </div>
            )}
            </section>
          </WindowedSection>
        );
      })}

      {/* Keyset Cursor Infinite Scroll Sentinel */}
      <div ref={sentinelRef} className="h-12 flex items-center justify-center my-4">
        {isLoadingMore && (
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-surface-container-high text-primary text-body-sm shadow-sm animate-in fade-in">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="font-medium text-[13px]">Loading more items...</span>
          </div>
        )}
        {!hasMore && groups.length > 0 && (
          <span className="text-[12px] font-medium text-on-surface-variant/40 uppercase tracking-wider">
            All media loaded
          </span>
        )}
      </div>
    </div>
  );
};


