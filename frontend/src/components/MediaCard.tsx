/**
 * =============================================================================
 * Module: frontend/src/components/MediaCard.tsx
 * Purpose: High-performance gallery grid tile with instant WebP thumbnail,
 *          constantly looping animated GIFs, 4-corner ergonomic layout (top-left selection,
 *          top-right favorite star, bottom-left video duration, bottom-right file format badge),
 *          dense mode adaptive scaling, context menu forwarding, and HTML5 drag-and-drop.
 * Used by: frontend/src/components/TimelineGrid.tsx
 * Dependencies: lucide-react, frontend/src/types.ts, frontend/src/utils/fileTypes.ts
 * Public Members: MediaCard
 * Side Effects: Triggers lightbox click, selection toggle, favorite toggle, drag start, and context menu events.
 * =============================================================================
 */

import React, { useState, useRef, useEffect } from "react";
import { Play, Image as ImageIcon, Camera, Check, Star } from "lucide-react";
import { MediaItem } from "../types";
import { getFileTypeBadge } from "../utils/fileTypes";
import { emptyDragImage } from "./ui/DragStackedPreview";

interface MediaCardProps {
  item: MediaItem;
  isSelected: boolean;
  isSelectionMode: boolean;
  selectedIds: Set<number>;
  aspectMode?: "square" | "natural";
  isDense?: boolean;
  onClick: () => void;
  onToggleSelect: (id: number, e?: React.MouseEvent) => void;
  onToggleFavorite?: (id: number, isFavorite: boolean) => void;
  onContextMenu: (e: React.MouseEvent, item: MediaItem) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  isSelected,
  isSelectionMode,
  selectedIds,
  aspectMode = "square",
  isDense = false,
  onClick,
  onToggleSelect,
  onToggleFavorite,
  onContextMenu,
}) => {
  const [loaded, setLoaded] = useState(false);

  const isVideo = item.mime_type.startsWith("video/");
  const isGif = item.mime_type === "image/gif" || item.file_name.toLowerCase().endsWith(".gif");
  const isAnimatedVideo = isVideo && (item.file_name.toLowerCase().includes(".gif.mp4") || (Boolean(item.duration_seconds && item.duration_seconds <= 15) && item.file_name.toLowerCase().includes("gif")));

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // Long-press detection refs
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActiveRef = useRef(false);
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    isLongPressActiveRef.current = false;
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      onToggleSelect(item.id);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 450);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointerStartPosRef.current) {
      const dist = Math.hypot(
        e.clientX - pointerStartPosRef.current.x,
        e.clientY - pointerStartPosRef.current.y
      );
      if (dist > 8 && longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handlePointerUpOrCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartPosRef.current = null;
  };

  const formatDuration = (sec: number | null) => {
    if (!sec) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressActiveRef.current) {
      isLongPressActiveRef.current = false;
      return;
    }

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

    // Suppress default full card drag preview in favor of custom stacked card deck
    if (emptyDragImage && e.dataTransfer.setDragImage) {
      e.dataTransfer.setDragImage(emptyDragImage, 0, 0);
    }
  };

  const aspectRatioStyle: React.CSSProperties =
    aspectMode === "natural" && item.width && item.height
      ? { aspectRatio: `${item.width} / ${item.height}` }
      : {};

  const fileBadge = getFileTypeBadge(item.file_name, item.mime_type);

  return (
    <div
      className={`relative group transition-transform duration-150 ease-out hover:scale-[1.015] ${
        aspectMode === "natural" ? "w-full min-h-[120px]" : "aspect-square"
      }`}
    >
      <div
        draggable
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onDragStart={handleDragStart}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, item)}
        style={aspectRatioStyle}
        className={`media-card-item relative overflow-hidden bg-surface-container ${
          isDense ? "rounded-lg" : "rounded-xl"
        } h-full w-full cursor-pointer transition-all duration-200 shadow-md hover:shadow-xl active:scale-[0.98] ${
          isSelected ? "ring-2 ring-primary shadow-primary/30" : ""
        }`}
      >
        <div className="relative w-full h-full overflow-hidden bg-surface-container">
          {/* Top-Left: Selection Checkbox (Clean Neomorphic, Hover-revealed like Favorite, Solid Accent Active) */}
          <div
            onClick={handleCheckboxClick}
            className={`absolute z-[3] rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer shadow-sm ${
              isDense ? "top-1.5 left-1.5 w-5 h-5" : "top-2.5 left-2.5 w-6 h-6"
            } ${
              isSelected
                ? "bg-primary text-on-primary border border-primary scale-105 opacity-100 shadow-md shadow-primary/30"
                : isSelectionMode
                  ? "bg-surface-base/90 border border-outline-variant/60 hover:border-primary hover:scale-110 opacity-70 group-hover:opacity-100 text-transparent hover:text-primary/40"
                  : "bg-surface-base/90 border border-outline-variant/50 hover:border-primary hover:scale-110 opacity-0 group-hover:opacity-100 text-transparent hover:text-primary/40"
            }`}
            title={isSelected ? "Deselect item" : "Select item"}
          >
            {isSelected ? (
              <Check className={`${isDense ? "w-3 h-3" : "w-3.5 h-3.5"} text-on-primary`} strokeWidth={3} />
            ) : (
              <Check className={`${isDense ? "w-3 h-3" : "w-3.5 h-3.5"} transition-colors`} strokeWidth={2.5} />
            )}
          </div>

          {/* Selected Dimming Overlay */}
          {isSelected && (
            <div className="absolute inset-0 bg-primary/10 z-[1] pointer-events-none" />
          )}

          {/* Constantly Playing Animated Loop: GIF or Telegram .gif.mp4 Animation */}
          {isAnimatedVideo ? (
            <video
              src={`${item.stream_url}?preview=1`}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover pointer-events-none select-none"
            />
          ) : isGif ? (
            <img
              src={item.stream_url}
              alt={item.file_name}
              draggable={false}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none select-none"
            />
          ) : item.thumbnail_url ? (
            /* Instant Local WebP Thumbnail (0ms) - Always present */
            <img
              src={item.thumbnail_url}
              alt={item.file_name}
              draggable={false}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none select-none ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-on-surface-variant bg-surface-container">
              <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
              <span className="text-[10px] truncate max-w-[80%]">
                {item.file_name}
              </span>
            </div>
          )}

          {/* Top-Right: Star Favorite Button exclusively */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onToggleFavorite) {
                onToggleFavorite(item.id, !item.is_favorite);
              }
            }}
            title={item.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
            className={`absolute z-[3] rounded-full transition-all duration-150 shadow-sm pointer-events-auto cursor-pointer ${
              isDense ? "top-1.5 right-1.5 w-5 h-5 flex items-center justify-center p-0" : "top-2.5 right-2.5 p-1.5"
            } ${
              item.is_favorite
                ? "bg-amber-500/25 text-amber-400 border border-amber-500/40 opacity-100 scale-100"
                : "bg-surface-base/90 text-on-surface-variant hover:text-amber-400 opacity-0 group-hover:opacity-100 border border-outline-variant/30 hover:scale-110"
            }`}
          >
            <Star
              className={`${isDense ? "w-3 h-3" : "w-3.5 h-3.5"} ${item.is_favorite ? "fill-amber-400 text-amber-400" : ""}`}
              strokeWidth={2}
            />
          </button>

          {/* Bottom-Left: Video Duration Pill Badge (only for regular videos) */}
          {isVideo && !isAnimatedVideo && (
            <div className={`absolute z-[2] pointer-events-none group-hover:opacity-0 transition-opacity duration-150 ${
              isDense ? "bottom-1.5 left-1.5" : "bottom-2.5 left-2.5"
            }`}>
              <div className={`bg-surface-base/85 backdrop-blur-xs text-on-surface rounded-full flex items-center shadow-sm ${
                isDense ? "px-1.5 py-0.5 text-[9px] gap-0.5" : "px-2 py-0.5 text-label-md gap-1"
              }`}>
                <Play className={`${isDense ? "w-2 h-2" : "w-2.5 h-2.5"} fill-current shrink-0 text-primary`} />
                <span className="font-mono">
                  {item.duration_seconds ? formatDuration(item.duration_seconds) : "Video"}
                </span>
              </div>
            </div>
          )}

          {/* Bottom-Right: Color-Coded File Format Badge */}
          <div
            className={`absolute z-[2] pointer-events-none transition-opacity duration-150 ${
              isDense
                ? "bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100"
                : "bottom-2.5 right-2.5 opacity-90 group-hover:opacity-0"
            }`}
          >
            <div
              className={`rounded-full font-bold tracking-wider uppercase flex items-center shadow-sm ${
                isDense ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-0.5 text-[10px]"
              } ${fileBadge.badgeClass}`}
            >
              <span>{fileBadge.extension}</span>
            </div>
          </div>

          {/* Overlay details on hover */}
          <div
            className={`absolute inset-0 z-[1] bg-gradient-to-t from-surface-base/90 via-surface-base/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end pointer-events-none ${
              isDense ? "p-1.5" : "p-3"
            }`}
          >
            <span className={`font-semibold text-on-surface truncate ${isDense ? "text-[10px]" : "text-xs"}`}>
              {item.file_name}
            </span>
            {!isDense && (
              <div className="flex items-center gap-2 text-[10px] text-on-surface-variant mt-0.5">
                {item.camera_model && (
                  <span className="flex items-center gap-1 font-sans">
                    <Camera className="w-3 h-3 text-primary" />
                    {item.camera_model}
                  </span>
                )}
                {item.width && item.height && (
                  <span>
                    {item.width}×{item.height}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
