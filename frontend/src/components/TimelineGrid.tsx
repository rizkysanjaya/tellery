/**
 * =============================================================================
 * Module: frontend/src/components/TimelineGrid.tsx
 * Purpose: Chronological timeline section with sticky date headers, responsive grid,
 *          and per-section select-all toggles for multi-select mode.
 * Used by: frontend/src/App.tsx
 * Dependencies: frontend/src/types.ts, frontend/src/components/MediaCard.tsx, lucide-react
 * Public Members: TimelineGrid
 * Side Effects: Dispatches media item click, selection toggle, and context menu events.
 * =============================================================================
 */

import React from "react";
import {
  Calendar,
  Image as ImageIcon,
  CheckSquare,
  Square,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { DisplayLayout, MediaItem, SortOption, TimelineGroup } from "../types";
import { MediaCard } from "./MediaCard";
import { MediaListItem } from "./MediaListItem";

interface TimelineGridProps {
  groups: TimelineGroup[];
  selectedIds: Set<number>;
  layout?: DisplayLayout;
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  onSelectMedia: (item: MediaItem) => void;
  onToggleSelect: (id: number, e?: React.MouseEvent) => void;
  onSelectAllInGroup: (ids: number[]) => void;
  onDeselectAllInGroup: (ids: number[]) => void;
  onContextMenu: (e: React.MouseEvent, item: MediaItem) => void;
  loading: boolean;
}

export const TimelineGrid: React.FC<TimelineGridProps> = ({
  groups,
  selectedIds,
  layout = "grid",
  sortBy = "date_desc",
  onSortChange,
  onSelectMedia,
  onToggleSelect,
  onSelectAllInGroup,
  onDeselectAllInGroup,
  onContextMenu,
  loading,
}) => {
  const isSelectionMode = selectedIds.size > 0;

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

  if (!loading && groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600 mb-4">
          <ImageIcon className="w-8 h-8 opacity-40" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-300">No media items found</h3>
        <p className="text-sm text-zinc-500 max-w-sm mt-1">
          Import photos and videos into your private Telegram storage channel using the CLI:
        </p>
        <code className="mt-3 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-sky-400 font-mono">
          python -m src.cli.import_folder "D:\Pictures"
        </code>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-16">
      {groups.map((group) => {
        const groupItemIds = group.items.map((i) => i.id);
        const allSelected =
          groupItemIds.length > 0 &&
          groupItemIds.every((id) => selectedIds.has(id));
        const someSelected = groupItemIds.some((id) => selectedIds.has(id));

        return (
          <section key={group.period_key} className="space-y-4">
            {/* Sticky Month/Year Header */}
            <div className="sticky top-[69px] z-20 bg-zinc-950/90 backdrop-blur-md py-2 border-b border-zinc-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-400" />
                <h2 className="text-base font-bold text-zinc-100 tracking-tight">
                  {group.period}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-zinc-500">
                  {group.count} {group.count === 1 ? "item" : "items"}
                </span>

                {/* Section Select All / Deselect All Toggle */}
                <button
                  onClick={() => {
                    if (allSelected) {
                      onDeselectAllInGroup(groupItemIds);
                    } else {
                      onSelectAllInGroup(groupItemIds);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    allSelected
                      ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                      : someSelected
                        ? "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-sky-500/50"
                        : "bg-zinc-900 text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-700 opacity-0 group-hover:opacity-100"
                  } ${isSelectionMode || someSelected ? "!opacity-100" : ""}`}
                  title={
                    allSelected
                      ? "Deselect all in this section"
                      : "Select all in this section"
                  }
                >
                  {allSelected ? (
                    <CheckSquare className="w-3.5 h-3.5" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                  <span>{allSelected ? "Deselect" : "Select"}</span>
                </button>
              </div>
            </div>

            {/* Layout Rendering Variants */}
            {layout === "list" ? (
              /* Detailed Table/List View */
              <div className="space-y-1.5">
                {/* Interactive Clickable List Header */}
                <div className="hidden sm:flex items-center justify-between px-4 py-1 text-[11px] font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-900/60 pb-1 select-none">
                  <button
                    onClick={() => toggleSort("name")}
                    className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Name</span>
                    {sortBy.startsWith("name") &&
                      (sortBy === "name_asc" ? (
                        <ArrowUp className="w-3 h-3 text-sky-400" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-sky-400" />
                      ))}
                  </button>

                  <div className="flex items-center gap-8 text-right">
                    <button
                      onClick={() => toggleSort("date")}
                      className="w-24 flex items-center justify-end gap-1 hover:text-white transition-colors cursor-pointer"
                    >
                      <span>Date Taken</span>
                      {sortBy.startsWith("date") &&
                        (sortBy === "date_asc" ? (
                          <ArrowUp className="w-3 h-3 text-sky-400" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-sky-400" />
                        ))}
                    </button>
                    <span className="hidden md:inline w-24">Dimensions</span>
                    <button
                      onClick={() => toggleSort("size")}
                      className="w-16 flex items-center justify-end gap-1 hover:text-white transition-colors cursor-pointer"
                    >
                      <span>Size</span>
                      {sortBy.startsWith("size") &&
                        (sortBy === "size_asc" ? (
                          <ArrowUp className="w-3 h-3 text-sky-400" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-sky-400" />
                        ))}
                    </button>
                    <span className="w-6"></span>
                  </div>
                </div>

                <div className="space-y-1">
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
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5 sm:gap-2">
                {group.items.map((item) => (
                  <MediaCard
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
            ) : layout === "masonry" ? (
              /* Natural Aspect-Ratio Showcase Grid */
              <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-3 sm:gap-4 space-y-3 sm:space-y-4">
                {group.items.map((item) => (
                  <div key={item.id} className="break-inside-avoid">
                    <MediaCard
                      item={item}
                      isSelected={selectedIds.has(item.id)}
                      isSelectionMode={isSelectionMode}
                      selectedIds={selectedIds}
                      aspectMode="natural"
                      onClick={() => onSelectMedia(item)}
                      onToggleSelect={onToggleSelect}
                      onContextMenu={onContextMenu}
                    />
                  </div>
                ))}
              </div>
            ) : (
              /* Standard Square Responsive Grid */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                {group.items.map((item) => (
                  <MediaCard
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
            )}
          </section>
        );
      })}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
