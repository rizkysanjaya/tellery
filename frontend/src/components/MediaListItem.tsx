/**
 * =============================================================================
 * Module: frontend/src/components/MediaListItem.tsx
 * Purpose: Detailed table/list row layout component for a media item, displaying
 *          thumbnail, filename, folder tags, resolution, duration, file size, and actions.
 * Used by: frontend/src/components/TimelineGrid.tsx (in "list" layout mode)
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: MediaListItem
 * Side Effects: Dispatches selection toggle, lightbox open, and context menu events.
 * =============================================================================
 */

import React from "react";
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

interface MediaListItemProps {
  item: MediaItem;
  isSelected: boolean;
  isSelectionMode: boolean;
  selectedIds: Set<number>;
  onClick: () => void;
  onToggleSelect: (id: number, e?: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, item: MediaItem) => void;
}

export const MediaListItem: React.FC<MediaListItemProps> = ({
  item,
  isSelected,
  isSelectionMode,
  selectedIds,
  onClick,
  onToggleSelect,
  onContextMenu,
}) => {
  const isVideo = item.mime_type.startsWith("video/");

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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
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

  const handleClick = (e: React.MouseEvent) => {
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
  };

  const fileBadge = getFileTypeBadge(item.file_name, item.mime_type);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, item)}
      className={`media-card-item group flex items-center justify-between px-3 py-2 neo-card rounded-neo transition-all duration-150 cursor-pointer select-none ${
        isSelected
          ? "bg-surface-container-high ring-2 ring-primary"
          : "bg-surface-base hover:bg-surface-container hover:-translate-y-[1px]"
      }`}
    >
      {/* Left: Checkbox + Thumbnail + Filename */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Selection Checkbox */}
        <div
          onClick={handleCheckboxClick}
          className={`w-5 h-5 rounded-[4px] flex items-center justify-center transition-all shrink-0 cursor-pointer ${
            isSelected
              ? "bg-primary text-on-primary"
              : isSelectionMode
                ? "bg-surface-container-highest border border-outline-variant hover:border-primary"
                : "bg-surface-container border border-outline-variant opacity-0 group-hover:opacity-100 hover:border-primary"
          }`}
        >
          {isSelected && (
            <Check className="w-3 h-3 text-on-primary" strokeWidth={3} />
          )}
        </div>

        {/* Small Rounded Thumbnail */}
        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-surface-container shrink-0 neo-image-wrapper">
          <img
            src={item.thumbnail_url}
            alt={item.file_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {isVideo && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
              <Play className="w-3 h-3 text-white fill-white" />
            </div>
          )}
        </div>

        {/* Filename & Type Indicator */}
        <div className="min-w-0 flex-1 pr-2">
          <div className="flex items-center gap-2">
            {isVideo ? (
              <Film className={`w-3.5 h-3.5 shrink-0 ${fileBadge.textColor}`} />
            ) : (
              <ImageIcon className={`w-3.5 h-3.5 shrink-0 ${fileBadge.textColor}`} />
            )}
            <span className="text-xs font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
              {item.file_name}
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase shrink-0 font-mono ${fileBadge.pillClass}`}>
              {fileBadge.extension}
            </span>
          </div>

          {/* Folder Tag Badge */}
          {item.folder_name && (
            <div className="flex items-center gap-1 mt-0.5">
              <Folder className="w-2.5 h-2.5 text-glow-indigo shrink-0" />
              <span className="text-[10px] text-glow-indigo font-medium truncate max-w-[140px] px-1 py-0.2 rounded bg-surface-container border border-outline-variant/30">
                {item.folder_name}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Center & Right Metadata Columns */}
      <div className="flex items-center gap-4 sm:gap-8 shrink-0 text-xs text-on-surface-variant">
        {/* Date Taken */}
        <span className="hidden sm:inline w-24 text-right font-mono text-[11px] text-on-surface-variant">
          {formatDate(item.date_taken || item.created_at)}
        </span>

        {/* Specs / Duration */}
        <span className="hidden md:inline w-24 text-right text-on-surface-variant font-mono text-[11px]">
          {isVideo && item.duration_seconds
            ? formatDuration(item.duration_seconds)
            : item.width && item.height
              ? `${item.width}×${item.height}`
              : "-"}
        </span>

        {/* File Size */}
        <span className="w-16 text-right font-mono text-[11px] text-on-surface font-semibold">
          {formatFileSize(item.file_size)}
        </span>

        {/* More Actions Context Menu Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onContextMenu(e, item);
          }}
          className="p-1 rounded-neo text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
          title="More options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
