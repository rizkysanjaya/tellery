/**
 * =============================================================================
 * Module: frontend/src/components/MediaListItem.tsx
 * Purpose: Detailed table/list row layout component for a media item, displaying
 *          thumbnail, looping animated GIFs, on-hover animated video preview,
 *          battery saver low-power static thumbnail fallback, touch targets,
 *          filename, folder tags, resolution, duration, file size, and actions.
 * Used by: frontend/src/components/TimelineGrid.tsx (in "list" layout mode)
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: MediaListItem
 * Side Effects: Dispatches selection toggle, lightbox open, and context menu events.
 * =============================================================================
 */

import React, { useRef, useState, useEffect } from "react";
import {
  Check,
  Play,
  Image as ImageIcon,
  Film,
  Folder,
  MoreVertical,
} from "lucide-react";
import { MediaItem } from "../types";
import { getFileTypeBadge } from "../utils/fileTypes";
import { emptyDragImage } from "./ui/DragStackedPreview";

interface MediaListItemProps {
  item: MediaItem;
  isSelected: boolean;
  isSelectionMode: boolean;
  selectedIds: Set<number>;
  batterySaver?: boolean;
  onClick: () => void;
  onToggleSelect: (id: number, e?: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, item: MediaItem) => void;
}

export const MediaListItem: React.FC<MediaListItemProps> = ({
  item,
  isSelected,
  isSelectionMode,
  selectedIds,
  batterySaver = false,
  onClick,
  onToggleSelect,
  onContextMenu,
}) => {
  const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDuration = (secs: number | null) => {
    if (!secs) return null;
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const hoverPreviewTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isVideo = item.mime_type.startsWith("video/");
  const isGif = item.mime_type === "image/gif" || item.file_name.toLowerCase().endsWith(".gif");
  const isAnimatedVideo = isVideo && (item.file_name.toLowerCase().includes(".gif.mp4") || (Boolean(item.duration_seconds && item.duration_seconds <= 15) && item.file_name.toLowerCase().includes("gif")));

  useEffect(() => {
    return () => {
      if (hoverPreviewTimerRef.current) {
        clearTimeout(hoverPreviewTimerRef.current);
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (batterySaver) return;
    if (isVideo && !isAnimatedVideo) {
      if (hoverPreviewTimerRef.current) clearTimeout(hoverPreviewTimerRef.current);
      hoverPreviewTimerRef.current = setTimeout(() => {
        setIsPlayingPreview(true);
      }, 300);
    }
  };

  const handleMouseLeave = () => {
    if (hoverPreviewTimerRef.current) {
      clearTimeout(hoverPreviewTimerRef.current);
      hoverPreviewTimerRef.current = null;
    }
    setIsPlayingPreview(false);
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

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressActiveRef.current) {
      isLongPressActiveRef.current = false;
      return;
    }
    if (e.shiftKey || e.ctrlKey || e.metaKey || isSelectionMode) {
      onToggleSelect(item.id, e);
      return;
    }
    onClick();
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect(item.id, e);
  };

  const handleDragStart = (e: React.DragEvent) => {
    const payload =
      isSelected && selectedIds.size > 0
        ? Array.from(selectedIds)
        : [item.id];

    e.dataTransfer.setData(
      "application/telegallery-media",
      JSON.stringify(payload)
    );
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copyMove";

    // Suppress default full item drag preview in favor of custom stacked card deck
    if (emptyDragImage && e.dataTransfer.setDragImage) {
      e.dataTransfer.setDragImage(emptyDragImage, 0, 0);
    }
  };

  const fileBadge = getFileTypeBadge(item.file_name, item.mime_type);

  return (
    <div
      draggable
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onDragStart={handleDragStart}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, item)}
      className={`media-card-item group flex items-center justify-between px-3.5 py-2.5 neo-card rounded-neo-xl transition-all duration-150 cursor-pointer select-none border border-outline-variant/15 ${
        isSelected
          ? "bg-surface-container-high ring-2 ring-primary shadow-sm"
          : "bg-surface-base hover:bg-surface-container hover:border-outline-variant/30 hover:-translate-y-[1px]"
      }`}
    >
      {/* Left: Checkbox + Thumbnail + Filename & Details */}
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Selection Checkbox */}
        <div
          onClick={handleCheckboxClick}
          className={`w-6 h-6 rounded-neo flex items-center justify-center transition-all shrink-0 cursor-pointer touch-manipulation ${
            isSelected
              ? "bg-primary text-on-primary shadow-sm"
              : isSelectionMode
                ? "bg-surface-container-highest border border-outline-variant hover:border-primary"
                : "bg-surface-container border border-outline-variant opacity-0 group-hover:opacity-100 hover:border-primary"
          }`}
        >
          {isSelected && (
            <Check className="w-4 h-4 text-on-primary" strokeWidth={3} />
          )}
        </div>

        {/* Crisp Rounded Thumbnail / Constantly Playing GIF / Smooth Video Hover Preview */}
        <div className="relative w-14 h-14 rounded-neo-lg overflow-hidden bg-surface-container shrink-0 neo-image-wrapper border border-outline-variant/20 shadow-sm">
          {!batterySaver && isAnimatedVideo ? (
            <video
              src={item.stream_url}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover pointer-events-none select-none"
            />
          ) : (
            <img
              src={!batterySaver && isGif ? item.stream_url : (item.thumbnail_url || item.stream_url)}
              alt={item.file_name}
              className="w-full h-full object-cover pointer-events-none select-none"
              loading="lazy"
            />
          )}
          {isVideo && !isAnimatedVideo && !batterySaver && isPlayingPreview && (
            <video
              src={item.stream_url}
              autoPlay
              loop
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-[1] animate-in fade-in duration-200"
            />
          )}
          {isVideo && !isAnimatedVideo && (!isPlayingPreview || batterySaver) && (
            <div className="absolute inset-0 bg-black/35 flex items-center justify-center pointer-events-none">
              <Play className="w-4 h-4 text-white fill-white" />
            </div>
          )}
        </div>

        {/* Filename & Type Indicator */}
        <div className="min-w-0 flex-1 pr-3">
          <div className="flex items-center gap-2">
            {isVideo ? (
              <Film className={`w-4 h-4 shrink-0 ${fileBadge.textColor}`} />
            ) : (
              <ImageIcon className={`w-4 h-4 shrink-0 ${fileBadge.textColor}`} />
            )}
            <span className="text-[15px] font-bold text-on-surface truncate group-hover:text-primary transition-colors tracking-tight">
              {item.file_name}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-neo uppercase shrink-0 font-mono ${fileBadge.pillClass}`}>
              {fileBadge.extension}
            </span>
          </div>

          {/* Subtitle with Folder Tag & Mobile Specs */}
          <div className="flex items-center gap-2 mt-1">
            {item.folder_name && (
              <div className="flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs text-primary font-semibold truncate max-w-[180px] px-2 py-0.5 rounded-neo bg-primary/10 border border-primary/20">
                  {item.folder_name}
                </span>
              </div>
            )}
            <span className="sm:hidden text-xs text-on-surface-variant font-mono font-medium">
              {formatDate(item.date_taken || item.created_at)} • {formatFileSize(item.file_size)}
            </span>
          </div>
        </div>
      </div>

      {/* Center & Right Metadata Columns */}
      <div className="flex items-center gap-4 sm:gap-6 shrink-0 text-[13px] text-on-surface-variant">
        {/* Date Taken */}
        <span className="hidden sm:inline w-32 text-right font-mono text-[13px] text-on-surface-variant font-medium">
          {formatDate(item.date_taken || item.created_at)}
        </span>

        {/* Specs / Duration */}
        <span className="hidden md:inline w-32 text-right text-on-surface-variant font-mono text-[13px] font-medium">
          {isVideo && item.duration_seconds
            ? formatDuration(item.duration_seconds)
            : item.width && item.height
              ? `${item.width} × ${item.height}`
              : "—"}
        </span>

        {/* File Size */}
        <span className="w-24 text-right font-mono text-[13px] text-on-surface font-bold">
          {formatFileSize(item.file_size)}
        </span>

        {/* More Actions Context Menu Button */}
        <div className="w-8 flex justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onContextMenu(e, item);
            }}
            className="p-1.5 rounded-neo text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            title="More options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
