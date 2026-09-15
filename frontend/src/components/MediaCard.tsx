/**
 * =============================================================================
 * Module: frontend/src/components/MediaCard.tsx
 * Purpose: High-performance gallery grid tile with instant WebP thumbnail,
 *          automatic backoff retry for asynchronous background-generated video thumbnails,
 *          fallback error handling for unsupported raw files,
 *          WCAG 2.2 AA accessible keyboard navigation (Enter to view, Space to select),
 *          visible focus rings (:focus-visible), screen-reader aria-labels,
 *          constantly looping animated GIFs, 4-corner ergonomic layout (top-left selection,
 *          top-right favorite star, bottom-left video duration, bottom-right file format badge),
 *          battery saver / low power static thumbnail fallback, touch-manipulation targets,
 *          dense mode adaptive scaling, context menu forwarding, and HTML5 drag-and-drop.
 * Used by: frontend/src/components/TimelineGrid.tsx
 * Dependencies: lucide-react, frontend/src/types.ts, frontend/src/utils/fileTypes.ts
 * Public Members: MediaCard
 * Side Effects: Triggers lightbox click, selection toggle, favorite toggle, drag start,
 *               context menu events, and thumbnail retry timers.
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
  batterySaver?: boolean;
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
  batterySaver = false,
  onClick,
  onToggleSelect,
  onToggleFavorite,
  onContextMenu,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);

  const isVideo = item.mime_type.startsWith("video/");
  const isGif = item.mime_type === "image/gif" || item.file_name.toLowerCase().endsWith(".gif");
  const isAnimatedVideo = isVideo && (item.file_name.toLowerCase().includes(".gif.mp4") || (Boolean(item.duration_seconds && item.duration_seconds <= 15) && item.file_name.toLowerCase().includes("gif")));

  const handleImageError = () => {
    // For videos whose thumbnail is currently compiling in the background worker,
    // retry automatically up to 6 times with exponential backoff before showing fallback.
    if (isVideo && retryCount < 6) {
      const delay = Math.min(2000 * Math.pow(1.35, retryCount), 8000);
      setTimeout(() => {
        setRetryCount((prev) => prev + 1);
      }, delay);
    } else {
      setHasError(true);
    }
  };

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
    aspectMode === "natural"
      ? item.width && item.height
        ? { aspectRatio: `${item.width} / ${item.height}` }
        : naturalRatio
          ? { aspectRatio: `${naturalRatio}` }
          : isVideo
            ? { aspectRatio: "9 / 16" }
            : { aspectRatio: "1 / 1" }
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
        tabIndex={0}
        role="button"
        aria-label={`${item.file_name}, ${item.mime_type.startsWith("video") ? "Video" : "Photo"}${item.duration_seconds ? `, duration ${formatDuration(item.duration_seconds)}` : ""}, ${isSelected ? "selected" : "not selected"}`}
        aria-pressed={isSelected}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onClick();
          } else if (e.key === " " || e.key === "Spacebar") {
            e.preventDefault();
            onToggleSelect(item.id);
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        onDragStart={handleDragStart}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, item)}
        style={aspectRatioStyle}
        className={`media-card-item relative overflow-hidden bg-surface-container ${
          isDense ? "rounded-md" : "rounded-lg"
        } h-full w-full cursor-pointer transition-all duration-150 border border-white/[0.06] hover:border-white/20 active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${
          isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
        }`}
      >
        <div className="relative w-full h-full overflow-hidden bg-surface-container">
          {/* Top-Left: Selection Checkbox (Clean Frosted Glass Disc, High-Contrast Active Accent) */}
          <button
            type="button"
            onClick={handleCheckboxClick}
            aria-label={isSelected ? `Deselect ${item.file_name}` : `Select ${item.file_name}`}
            className={`absolute z-[3] rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
              isDense ? "top-1.5 left-1.5 w-5 h-5" : "top-2 left-2 w-6 h-6"
            } ${
              isSelected
                ? "bg-primary text-on-primary scale-105 opacity-100 shadow-md"
                : isSelectionMode
                  ? "bg-black/50 backdrop-blur-md border border-white/25 hover:border-white/50 hover:scale-105 opacity-80 group-hover:opacity-100 text-transparent"
                  : "bg-black/50 backdrop-blur-md border border-white/25 hover:border-white/50 hover:scale-105 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-transparent"
            }`}
            title={isSelected ? "Deselect item" : "Select item"}
          >
            {isSelected ? (
              <Check className={`${isDense ? "w-3 h-3" : "w-3.5 h-3.5"} text-on-primary`} strokeWidth={3} />
            ) : (
              <Check className={`${isDense ? "w-3 h-3" : "w-3.5 h-3.5"} transition-colors`} strokeWidth={2.5} />
            )}
          </button>

          {/* Selected Dimming Overlay */}
          {isSelected && (
            <div className="absolute inset-0 bg-primary/15 z-[1] pointer-events-none" />
          )}

          {/* Constantly Playing Animated Loop (GIF or Telegram .gif.mp4) or Low-Power Static Thumbnail */}
          {!batterySaver && isAnimatedVideo ? (
            <video
              src={`${item.stream_url}?preview=1`}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover pointer-events-none select-none"
            />
          ) : !batterySaver && isGif ? (
            <img
              src={item.stream_url}
              alt={item.file_name}
              draggable={false}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none select-none"
            />
          ) : item.thumbnail_url && !hasError ? (
            /* Instant Local WebP Thumbnail (0ms) - Standard & Battery Saver Fallback */
            <img
              key={`${item.id}-${retryCount}`}
              src={retryCount > 0 ? `${item.thumbnail_url}&r=${retryCount}` : item.thumbnail_url}
              alt={item.file_name}
              draggable={false}
              loading="lazy"
              onLoad={(e) => {
                setLoaded(true);
                setHasError(false);
                const w = e.currentTarget.naturalWidth;
                const h = e.currentTarget.naturalHeight;
                if (w && h && (!item.width || !item.height)) {
                  setNaturalRatio(w / h);
                }
              }}
              onError={handleImageError}
              className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none select-none ${
                loaded ? "opacity-100" : "opacity-0"
              }`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-on-surface-variant bg-surface-container/60 border border-white/[0.04]">
              {isVideo ? (
                <div className="w-10 h-10 rounded-full bg-surface-container-high/80 border border-white/10 flex items-center justify-center mb-2 text-primary shadow-sm">
                  <Play className="w-5 h-5 ml-0.5 fill-current" />
                </div>
              ) : (
                <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
              )}
              <span className="text-[11px] font-mono truncate max-w-[90%] text-center text-on-surface">
                {item.file_name}
              </span>
            </div>
          )}

          {/* Battery Saver Mode: Animation Indicator Badge */}
          {batterySaver && (isAnimatedVideo || isGif) && (
            <div className={`absolute z-[2] pointer-events-none ${isDense ? "bottom-1.5 left-1.5" : "bottom-2 left-2"}`}>
              <div className="bg-black/60 backdrop-blur-md text-primary font-mono font-bold px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] border border-primary/30">
                GIF
              </div>
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
            aria-label={item.is_favorite ? `Remove ${item.file_name} from Favorites` : `Add ${item.file_name} to Favorites`}
            title={item.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
            className={`absolute z-[3] rounded-full transition-all duration-150 pointer-events-auto cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
              isDense ? "top-1.5 right-1.5 w-5 h-5 flex items-center justify-center p-0" : "top-2 right-2 w-6 h-6 flex items-center justify-center p-0"
            } ${
              item.is_favorite
                ? "bg-black/60 backdrop-blur-md text-amber-400 border border-amber-400/40 opacity-100"
                : "bg-black/40 backdrop-blur-md text-white/70 hover:text-amber-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 border border-white/20 hover:scale-105"
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
              isDense ? "bottom-1.5 left-1.5" : "bottom-2 left-2"
            }`}>
              <div className="bg-black/60 backdrop-blur-md text-white font-mono rounded px-1.5 py-0.5 text-[10px] flex items-center gap-1 border border-white/10">
                <Play className="w-2.5 h-2.5 fill-current shrink-0 text-white" />
                <span>{item.duration_seconds ? formatDuration(item.duration_seconds) : "Video"}</span>
              </div>
            </div>
          )}

          {/* Bottom-Right: Clean File Format Badge */}
          <div
            className={`absolute z-[2] pointer-events-none transition-opacity duration-150 ${
              isDense
                ? "bottom-1.5 right-1.5 opacity-0 group-hover:opacity-100"
                : "bottom-2 right-2 opacity-90 group-hover:opacity-0"
            }`}
          >
            <div className="bg-black/60 backdrop-blur-md text-white/90 font-mono text-[9px] rounded px-1.5 py-0.5 border border-white/10 tracking-wider uppercase font-semibold">
              <span>{fileBadge.extension}</span>
            </div>
          </div>

          {/* Overlay details on hover */}
          <div
            className={`absolute inset-0 z-[1] bg-gradient-to-t from-black/85 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col justify-end pointer-events-none ${
              isDense ? "p-1.5" : "p-2.5"
            }`}
          >
            <span className={`font-semibold text-white truncate ${isDense ? "text-[10px]" : "text-xs"}`}>
              {item.file_name}
            </span>
            {!isDense && (
              <div className="flex items-center gap-2 text-[10px] text-zinc-300 mt-0.5">
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
