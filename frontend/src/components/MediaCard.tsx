/**
 * =============================================================================
 * Module: frontend/src/components/MediaCard.tsx
 * Purpose: High-performance gallery grid tile with instant WebP thumbnail,
 *          constantly looping animated GIFs, on-hover animated video preview,
 *          selection checkbox, context menu forwarding, and HTML5 drag-and-drop support.
 * Used by: frontend/src/components/TimelineGrid.tsx
 * Dependencies: lucide-react, frontend/src/types.ts
 * Public Members: MediaCard
 * Side Effects: Triggers lightbox click, selection toggle, drag start, and context menu events.
 * =============================================================================
 */

import React, { useState, useRef, useEffect } from "react";
import { Play, Image as ImageIcon, Camera, Check } from "lucide-react";
import { MediaItem } from "../types";
import { getFileTypeBadge } from "../utils/fileTypes";
import { emptyDragImage } from "./ui/DragStackedPreview";

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
  const [isHovered, setIsHovered] = useState(false);

  const isVideo = item.mime_type.startsWith("video/");
  const isGif = item.mime_type === "image/gif" || item.file_name.toLowerCase().endsWith(".gif");
  const isAnimatedVideo = isVideo && item.file_name.toLowerCase().endsWith(".gif.mp4");

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

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
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
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
        className={`media-card-item relative overflow-hidden bg-surface-container rounded-xl h-full w-full cursor-pointer transition-all duration-200 shadow-md hover:shadow-xl active:scale-[0.98] ${
          isSelected ? "ring-2 ring-primary shadow-primary/30" : ""
        }`}
      >
        <div className="relative w-full h-full overflow-hidden bg-surface-container">
          {/* Selection Checkbox (top-left) */}
          <div
            onClick={handleCheckboxClick}
            className={`absolute top-2.5 left-2.5 z-[2] w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
              isSelected
                ? "bg-primary-container text-on-surface scale-105"
                : isSelectionMode
                  ? "neo-button hover:text-on-surface"
                  : "neo-button opacity-0 group-hover:opacity-100 hover:text-on-surface"
            }`}
          >
            {isSelected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
          </div>

          {/* Selected Dimming Overlay */}
          {isSelected && (
            <div className="absolute inset-0 bg-primary/10 z-[1] pointer-events-none" />
          )}

          {/* Animated Video Clip (.gif.mp4) on Hover */}
          {isAnimatedVideo && isHovered ? (
            <video
              src={item.stream_url}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover pointer-events-none select-none"
            />
          ) : isGif ? (
            /* Constantly Playing Animated GIF */
            <img
              src={item.stream_url}
              alt={item.file_name}
              draggable={false}
              loading="lazy"
              onLoad={() => setLoaded(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none select-none"
            />
          ) : isVideo && isHovered ? (
            /* Ultra-Lightweight Video Hover Preview (~100KB Animated WebP) */
            <img
              src={`/api/media/${item.id}/preview`}
              alt={item.file_name}
              draggable={false}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none select-none"
            />
          ) : item.thumbnail_url ? (
            /* Instant Local WebP Thumbnail (0ms) */
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

          {/* Color-Coded File Format Badge (top-right) */}
          <div className="absolute top-2.5 right-2.5 z-[2] pointer-events-none">
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase flex items-center backdrop-blur-md shadow-sm ${fileBadge.badgeClass}`}>
              <span>{fileBadge.extension}</span>
            </div>
          </div>

          {/* Video Duration Pill Badge (bottom-left corner) */}
          {isVideo && (
            <div className="absolute bottom-2.5 left-2.5 z-[2] pointer-events-none group-hover:opacity-0 transition-opacity duration-150">
              <div className="bg-surface-base/85 backdrop-blur-xs text-on-surface text-label-md px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                <Play className="w-2.5 h-2.5 fill-current shrink-0 text-primary" />
                <span className="font-mono">
                  {item.duration_seconds ? formatDuration(item.duration_seconds) : "Video"}
                </span>
              </div>
            </div>
          )}

          {/* Overlay details on hover */}
          <div className="absolute inset-0 z-[1] bg-gradient-to-t from-surface-base/90 via-surface-base/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 pointer-events-none">
            <span className="text-xs font-semibold text-on-surface truncate">
              {item.file_name}
            </span>
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
          </div>
        </div>
      </div>
    </div>
  );
};
