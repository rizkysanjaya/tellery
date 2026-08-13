/**
 * =============================================================================
 * Module: frontend/src/components/MediaCard.tsx
 * Purpose: Interactive gallery grid tile with WebP thumbnail, selection checkbox,
 *          context menu forwarding, and HTML5 drag-and-drop support.
 * Used by: frontend/src/components/TimelineGrid.tsx
 * Dependencies: lucide-react, frontend/src/types.ts
 * Public Members: MediaCard
 * Side Effects: Triggers lightbox click, selection toggle, drag start, and context menu events.
 * =============================================================================
 */

import React, { useState } from "react";
import { Play, Image as ImageIcon, Camera, Check } from "lucide-react";
import { MediaItem } from "../types";

interface MediaCardProps {
  item: MediaItem;
  isSelected: boolean;
  isSelectionMode: boolean;
  selectedIds: Set<number>;
  aspectMode?: "square" | "natural";
  onClick: () => void;
  onToggleSelect: (id: number, e?: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, item: MediaItem) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  isSelected,
  isSelectionMode,
  selectedIds,
  aspectMode = "square",
  onClick,
  onToggleSelect,
  onContextMenu,
}) => {
  const [loaded, setLoaded] = useState(false);
  const isVideo = item.mime_type.startsWith("video/");

  const formatDuration = (sec: number | null) => {
    if (!sec) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleClick = (e: React.MouseEvent) => {
    // Shift+Click selects a continuous range (Google Drive style)
    if (e.shiftKey) {
      e.preventDefault();
      onToggleSelect(item.id, e);
      return;
    }

    // Ctrl/Cmd+Click always toggles single item selection
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onToggleSelect(item.id, e);
      return;
    }

    // In selection mode, clicking the card body toggles selection
    if (isSelectionMode) {
      onToggleSelect(item.id, e);
      return;
    }

    // Normal click opens lightbox
    onClick();
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect(item.id, e);
  };

  const handleDragStart = (e: React.DragEvent) => {
    const payload = isSelected && selectedIds.size > 0
      ? Array.from(selectedIds)
      : [item.id];
    
    e.dataTransfer.setData("application/telegallery-media", JSON.stringify(payload));
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copyMove";
  };

  // Dynamic aspect ratio calculation for natural masonry layout
  const aspectRatioStyle =
    aspectMode === "natural" && item.width && item.height
      ? { aspectRatio: `${item.width} / ${item.height}` }
      : undefined;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, item)}
      style={aspectRatioStyle}
      className={`media-card-item group relative bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer border transition-all duration-300 transform hover:-translate-y-1 ${
        aspectMode === "natural" ? "w-full min-h-[140px]" : "aspect-square"
      } ${
        isSelected
          ? "border-sky-500 ring-2 ring-sky-500/40 shadow-xl shadow-sky-500/15 scale-[0.97]"
          : "border-zinc-800/60 hover:border-sky-500/50 hover:shadow-xl hover:shadow-sky-500/10"
      }`}
    >
      {/* Selection Checkbox (top-left) */}
      <div
        onClick={handleCheckboxClick}
        className={`absolute top-2.5 left-2.5 z-10 w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
          isSelected
            ? "bg-sky-500 border-sky-500 shadow-lg shadow-sky-500/30"
            : isSelectionMode
              ? "bg-zinc-900/70 border border-zinc-600 backdrop-blur-md hover:border-sky-400"
              : "bg-zinc-900/70 border border-zinc-600 backdrop-blur-md opacity-0 group-hover:opacity-100 hover:border-sky-400"
        }`}
      >
        {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      </div>

      {/* Selected Dimming Overlay */}
      {isSelected && (
        <div className="absolute inset-0 bg-sky-500/10 z-[1] pointer-events-none" />
      )}

      {/* Thumbnail Image */}
      {item.thumbnail_url ? (
        <img
          src={item.thumbnail_url}
          alt={item.file_name}
          draggable={false}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 pointer-events-none select-none ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-900/50">
          <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
          <span className="text-[10px] text-zinc-500 truncate max-w-[80%]">
            {item.file_name}
          </span>
        </div>
      )}

      {/* Video Indicator / Play Badge */}
      {isVideo && (
        <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1.5 text-[11px] font-medium text-white shadow-sm border border-white/10">
          <Play className="w-3 h-3 fill-white text-white" />
          {item.duration_seconds ? <span>{formatDuration(item.duration_seconds)}</span> : null}
        </div>
      )}

      {/* Overlay details on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 pointer-events-none">
        <p className="text-xs font-semibold text-white truncate drop-shadow-sm">
          {item.file_name}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-zinc-300 mt-0.5">
          {item.camera_model && (
            <span className="flex items-center gap-1">
              <Camera className="w-3 h-3 text-sky-400" />
              {item.camera_model}
            </span>
          )}
          {item.width && item.height && (
            <span>
              {item.width}×{item.height}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
