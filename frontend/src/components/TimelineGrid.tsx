/**
 * =============================================================================
 * Module: frontend/src/components/TimelineGrid.tsx
 * Purpose: Chronological timeline section with sticky date headers, responsive grid,
 *          contextual empty states, per-section select-all toggles, chronological
 *          date-jump scrubber bar, dense grid ergonomics, and natural aspect masonry showcase.
 * Used by: frontend/src/App.tsx, frontend/src/components/FavoritesView.tsx
 * Dependencies: frontend/src/types.ts, frontend/src/components/MediaCard.tsx,
 *               frontend/src/components/MediaListItem.tsx, frontend/src/components/TimelineDateScrubber.tsx, lucide-react
 * Public Members: TimelineGrid
 * Side Effects: Dispatches media item click, selection toggle, favorite toggle, search clearing, and context menu events.
 * =============================================================================
 */

import React, { useEffect, useState } from "react";
import {
  Calendar,
  Image as ImageIcon,
  CheckSquare,
  Square,
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
  onSelectMedia: (item: MediaItem) => void;
  onToggleSelect: (id: number, e?: React.MouseEvent) => void;
  onSelectAllInGroup: (ids: number[]) => void;
  onDeselectAllInGroup: (ids: number[]) => void;
  onContextMenu: (e: React.MouseEvent, item: MediaItem) => void;
  onToggleFavorite?: (id: number, isFavorite: boolean) => void;
  loading: boolean;
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
  onSelectMedia,
  onToggleSelect,
  onSelectAllInGroup,
  onDeselectAllInGroup,
  onContextMenu,
  onToggleFavorite,
  loading,
}) => {
  const isSelectionMode = selectedIds.size > 0;
  const columnCount = useResponsiveColumns();

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
          <div className="w-20 h-20 rounded-neo-2xl neo-card bg-surface-base border border-dashed border-outline-variant/30 flex items-center justify-center text-on-surface-variant/40 mb-4 shadow-sm">
            <Search className="w-10 h-10" />
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
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 neo-button bg-surface-base text-on-surface hover:text-primary rounded-neo text-xs font-semibold cursor-pointer transition-all active:scale-95 shadow-sm"
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
          <div className="w-20 h-20 rounded-neo-2xl neo-card bg-surface-base border border-dashed border-outline-variant/30 flex items-center justify-center text-on-surface-variant/40 mb-4 shadow-sm">
            <FolderOpen className="w-10 h-10" />
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
        <div className="w-20 h-20 rounded-neo-2xl neo-card bg-surface-base border border-outline-variant/20 flex items-center justify-center text-on-surface-variant/50 mb-5 shadow-sm">
          <ImageIcon className="w-10 h-10 opacity-60" />
        </div>
        <h3 className="text-headline-md font-semibold text-on-surface tracking-tight">No media in vault</h3>
        <p className="text-body-sm text-on-surface-variant max-w-sm mt-1.5 leading-relaxed">
          Upload media directly using the button above or sync local folders via the CLI:
        </p>
        <code className="mt-4 px-3.5 py-2 neo-pressed bg-surface-container rounded-neo text-label-md text-glow-indigo font-mono select-all">
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
          <section
            key={group.period_key}
            id={`timeline-group-${group.period_key}`}
            className="space-y-3.5 scroll-mt-24"
          >
            {/* Floating Rounded Month/Year Header Card */}
            <div className="sticky top-[68px] z-30 py-2">
              <div className="flex items-center justify-between w-full bg-surface-base border border-outline-variant/15 rounded-neo-xl px-5 py-3 neo-card shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] group/header">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-neo bg-primary/10 neo-pressed flex items-center justify-center text-primary shrink-0 shadow-xs">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-3 min-w-0">
                    <h2 className="text-xl font-bold text-on-surface tracking-tight truncate">
                      {group.period || group.period_title || "Unknown Date"}
                    </h2>
                    <span className="text-base font-semibold text-on-surface-variant shrink-0">
                      • {group.items.length} {group.items.length === 1 ? "item" : "items"}
                    </span>
                  </div>
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
                    className={`neo-button flex items-center gap-2 px-3.5 py-1.5 rounded-neo text-sm font-semibold transition-all cursor-pointer ${
                      allSelected
                        ? "text-primary bg-surface-container-high"
                        : "text-on-surface-variant opacity-0 group-hover/header:opacity-100 hover:text-on-surface"
                    } ${isSelectionMode || someSelected ? "!opacity-100" : ""}`}
                    title={
                      allSelected
                        ? "Deselect all in this section"
                        : "Select all in this section"
                    }
                  >
                    {allSelected ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-on-surface-variant" />
                    )}
                    <span>{allSelected ? "Deselect" : "Select"}</span>
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
                      onClick={() => onSelectMedia(item)}
                      onToggleSelect={onToggleSelect}
                      onContextMenu={onContextMenu}
                    />
                  ))}
                </div>
              </div>
            ) : layout === "dense" ? (
              /* Dense High-Capacity Grid */
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 sm:gap-3">
                {group.items.map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    isSelected={selectedIds.has(item.id)}
                    isSelectionMode={isSelectionMode}
                    selectedIds={selectedIds}
                    isDense={true}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
                {group.items.map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    isSelected={selectedIds.has(item.id)}
                    isSelectionMode={isSelectionMode}
                    selectedIds={selectedIds}
                    onClick={() => onSelectMedia(item)}
                    onToggleSelect={onToggleSelect}
                    onToggleFavorite={onToggleFavorite}
                    onContextMenu={onContextMenu}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};


