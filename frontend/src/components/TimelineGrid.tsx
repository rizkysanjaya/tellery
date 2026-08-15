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
import { Calendar, Image as ImageIcon, CheckSquare, Square } from "lucide-react";
import { MediaItem, TimelineGroup } from "../types";
import { MediaCard } from "./MediaCard";

interface TimelineGridProps {
  groups: TimelineGroup[];
  selectedIds: Set<number>;
  onSelectMedia: (item: MediaItem) => void;
  onToggleSelect: (id: number) => void;
  onSelectAllInGroup: (ids: number[]) => void;
  onDeselectAllInGroup: (ids: number[]) => void;
  onContextMenu: (e: React.MouseEvent, item: MediaItem) => void;
  loading: boolean;
}

export const TimelineGrid: React.FC<TimelineGridProps> = ({
  groups,
  selectedIds,
  onSelectMedia,
  onToggleSelect,
  onSelectAllInGroup,
  onDeselectAllInGroup,
  onContextMenu,
  loading,
}) => {
  const isSelectionMode = selectedIds.size > 0;

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
        const allSelected = groupItemIds.length > 0 && groupItemIds.every((id) => selectedIds.has(id));
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
                  title={allSelected ? "Deselect all in this section" : "Select all in this section"}
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

            {/* Responsive Media Tiles Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {group.items.map((item) => (
                <MediaCard
                  key={item.id}
                  item={item}
                  isSelected={selectedIds.has(item.id)}
                  isSelectionMode={isSelectionMode}
                  onClick={() => onSelectMedia(item)}
                  onToggleSelect={onToggleSelect}
                  onContextMenu={onContextMenu}
                />
              ))}
            </div>
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
