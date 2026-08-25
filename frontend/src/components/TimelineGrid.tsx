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
      <div className="flex flex-col items-center justify-center py-28 text-center px-4 animate-in fade-in duration-200">
        <div className="w-20 h-20 rounded-neo-xl neo-card bg-surface-base flex items-center justify-center text-on-surface-variant mb-5">
          <ImageIcon className="w-9 h-9 opacity-60" />
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
    <div className="space-y-10 pb-20">
      {groups.map((group) => {
        const groupItemIds = group.items.map((i) => i.id);
        const allSelected =
          groupItemIds.length > 0 &&
          groupItemIds.every((id) => selectedIds.has(id));
        const someSelected = groupItemIds.some((id) => selectedIds.has(id));

        return (
          <section key={group.period_key} className="space-y-3.5">
            {/* Floating Rounded Month/Year Header Card */}
            <div className="sticky top-[68px] z-30 py-2">
              <div className="flex items-center justify-between w-full bg-surface-base border border-outline-variant/15 rounded-neo-xl px-4 py-2.5 neo-card shadow-[0_4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.35)] group/header">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 neo-pressed flex items-center justify-center text-primary shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <h2 className="text-headline-md font-semibold text-on-surface tracking-tight truncate">
                      {group.period}
                    </h2>
                    <span className="text-headline-md font-medium text-on-surface-variant shrink-0">
                      • {group.count} {group.count === 1 ? "item" : "items"}
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
                    className={`neo-button flex items-center gap-1.5 px-3 py-1 rounded-neo text-label-md font-medium transition-all cursor-pointer ${
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
                      <CheckSquare className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-on-surface-variant" />
                    )}
                    <span className="text-xs">{allSelected ? "Deselect" : "Select"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Layout Rendering Variants */}
            {layout === "list" ? (
              /* Detailed Table/List View */
              <div className="space-y-2">
                {/* Interactive Clickable List Header */}
                <div className="hidden sm:flex items-center justify-between px-4 py-2 text-label-md font-semibold text-on-surface-variant uppercase tracking-wider pb-2 select-none">
                  <button
                    onClick={() => toggleSort("name")}
                    className="flex items-center gap-1 hover:text-on-surface transition-colors cursor-pointer"
                  >
                    <span>Name</span>
                    {sortBy.startsWith("name") &&
                      (sortBy === "name_asc" ? (
                        <ArrowUp className="w-3 h-3 text-primary" />
                      ) : (
                        <ArrowDown className="w-3 h-3 text-primary" />
                      ))}
                  </button>

                  <div className="flex items-center gap-8 text-right">
                    <button
                      onClick={() => toggleSort("date")}
                      className="w-24 flex items-center justify-end gap-1 hover:text-on-surface transition-colors cursor-pointer"
                    >
                      <span>Date Taken</span>
                      {sortBy.startsWith("date") &&
                        (sortBy === "date_asc" ? (
                          <ArrowUp className="w-3 h-3 text-primary" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-primary" />
                        ))}
                    </button>
                    <span className="hidden md:inline w-24">Dimensions</span>
                    <button
                      onClick={() => toggleSort("size")}
                      className="w-16 flex items-center justify-end gap-1 hover:text-on-surface transition-colors cursor-pointer"
                    >
                      <span>Size</span>
                      {sortBy.startsWith("size") &&
                        (sortBy === "size_asc" ? (
                          <ArrowUp className="w-3 h-3 text-primary" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-primary" />
                        ))}
                    </button>
                    <span className="w-6"></span>
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
                    onClick={() => onSelectMedia(item)}
                    onToggleSelect={onToggleSelect}
                    onContextMenu={onContextMenu}
                  />
                ))}
              </div>
            ) : layout === "masonry" ? (
              /* Natural Aspect-Ratio Showcase Grid */
              <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 xl:columns-6 gap-4 sm:gap-5 space-y-4 sm:space-y-5">
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
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};


