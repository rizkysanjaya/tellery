/**
 * =============================================================================
 * Module: frontend/src/components/TimelineGrid.tsx
 * Purpose: Chronological timeline section with sticky date headers and responsive grid.
 * Used by: frontend/src/App.tsx
 * Dependencies: frontend/src/types.ts, frontend/src/components/MediaCard.tsx, lucide-react
 * Public Members: TimelineGrid
 * Side Effects: Dispatches media item click to open lightbox.
 * =============================================================================
 */

import React from "react";
import { Calendar, Image as ImageIcon } from "lucide-react";
import { MediaItem, TimelineGroup } from "../types";
import { MediaCard } from "./MediaCard";

interface TimelineGridProps {
  groups: TimelineGroup[];
  onSelectMedia: (item: MediaItem) => void;
  loading: boolean;
}

export const TimelineGrid: React.FC<TimelineGridProps> = ({
  groups,
  onSelectMedia,
  loading,
}) => {
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
      {groups.map((group) => (
        <section key={group.period_key} className="space-y-4">
          {/* Sticky Month/Year Header */}
          <div className="sticky top-[69px] z-20 bg-zinc-950/90 backdrop-blur-md py-2 border-b border-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400" />
              <h2 className="text-base font-bold text-zinc-100 tracking-tight">
                {group.period}
              </h2>
            </div>
            <span className="text-xs font-medium text-zinc-500">
              {group.count} {group.count === 1 ? "item" : "items"}
            </span>
          </div>

          {/* Responsive Media Tiles Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {group.items.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                onClick={() => onSelectMedia(item)}
              />
            ))}
          </div>
        </section>
      ))}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
