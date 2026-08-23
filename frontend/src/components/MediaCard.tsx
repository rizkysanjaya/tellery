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
import { SpotlightCard } from "./ui/SpotlightCard";

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

  const aspectRatioStyle: React.CSSProperties =
    aspectMode === "natural" && item.width && item.height
      ? { aspectRatio: `${item.width} / ${item.height}` }
      : {};

  const getFileExtension = (filename: string, mimeType: string) => {
    const lastDot = filename.lastIndexOf(".");
    if (lastDot !== -1 && lastDot < filename.length - 1) {
      const ext = filename.substring(lastDot + 1).toUpperCase();
      if (ext.length <= 4) {
        if (ext === "JPEG") return "JPG";
        return ext;
      }
    }
    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "JPG";
    if (mimeType.includes("png")) return "PNG";
    if (mimeType.includes("webp")) return "WEBP";
    if (mimeType.includes("gif")) return "GIF";
    if (mimeType.includes("heic")) return "HEIC";
    if (mimeType.includes("mp4")) return "MP4";
    if (mimeType.includes("quicktime") || mimeType.includes("mov")) return "MOV";
    if (mimeType.includes("matroska") || mimeType.includes("mkv")) return "MKV";
    if (mimeType.startsWith("video/")) return "VIDEO";
    return "IMG";
  };

  const fileExt = getFileExtension(item.file_name, item.mime_type);

  return (
    <div
      className={`relative transition-transform duration-150 ease-out hover:-translate-y-1 active:scale-[0.98] ${
        aspectMode === "natural" ? "w-full min-h-[140px]" : "aspect-square"
      }`}
    >
      <SpotlightCard
        draggable
        onDragStart={handleDragStart}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, item)}
        style={aspectRatioStyle}
        className={`media-card-item group relative h-full w-full rounded-2xl overflow-hidden cursor-pointer border transition-all duration-300 ${
          isSelected
            ? "border-sky-500 ring-2 ring-sky-500/50 shadow-[0_0_25px_rgba(14,165,233,0.35)] scale-[0.98]"
            : "border-white/[0.08] hover:border-sky-500/40 hover:shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
        }`}
      >
        {/* Selection Checkbox (top-left) */}
        <div
          onClick={handleCheckboxClick}
          className={`absolute top-2.5 left-2.5 z-20 w-6 h-6 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
            isSelected
              ? "bg-sky-500 border border-sky-400 shadow-[0_0_12px_rgba(14,165,233,0.5)] scale-105"
              : isSelectionMode
                ? "bg-zinc-950/70 border border-white/20 backdrop-blur-md hover:border-sky-400"
                : "bg-zinc-950/70 border border-white/20 backdrop-blur-md opacity-0 group-hover:opacity-100 hover:border-sky-400"
          }`}
        >
          {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
        </div>

        {/* Selected Dimming Overlay */}
        {isSelected && (
          <div className="absolute inset-0 bg-sky-500/15 z-[1] pointer-events-none" />
        )}

        {/* Thumbnail Image */}
        {item.thumbnail_url ? (
          <img
            src={item.thumbnail_url}
            alt={item.file_name}
            draggable={false}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 pointer-events-none select-none ${
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

        {/* File Format / Video Duration Pill Badge */}
        <div className="absolute top-2.5 right-2.5 z-20 bg-black/60 backdrop-blur-xl px-2 py-0.5 rounded-lg flex items-center gap-1.5 text-[10px] font-semibold text-white shadow-sm border border-white/10 select-none">
          <span className={isVideo ? "font-bold text-sky-400" : "font-bold text-zinc-200"}>
            {fileExt}
          </span>
          {isVideo && (
            <>
              <span className="w-0.5 h-2.5 bg-white/20 rounded-full" />
              <Play className="w-2.5 h-2.5 fill-white text-white shrink-0" />
              {item.duration_seconds && (
                <span className="font-mono text-zinc-200">
                  {formatDuration(item.duration_seconds)}
                </span>
              )}
            </>
          )}
        </div>

        {/* Overlay details on hover */}
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 pointer-events-none">
          <p className="text-xs font-semibold text-white truncate drop-shadow-sm">
            {item.file_name}
          </p>
          <div className="flex items-center gap-2 text-[10px] text-zinc-300 mt-0.5 font-mono">
            {item.camera_model && (
              <span className="flex items-center gap-1 font-sans">
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
      </SpotlightCard>
    </div>
  );
};
