/**
 * =============================================================================
 * Module: frontend/src/components/TrashView.tsx
 * Purpose: Pro-grade obsidian Trash & Data Recovery view displaying soft-deleted media items,
 *          supporting 1-click restore, bulk restoration, individual permanent purge,
 *          and empty trash confirmation modal with Telegram vault sync.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts, frontend/src/api.ts
 * Public Members: TrashView
 * Side Effects: Calls restore/permanent delete APIs, updates local selection, triggers toasts.
 * =============================================================================
 */

import React, { useState } from "react";
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Film,
  Image as ImageIcon,
  CheckSquare,
  Square,
} from "lucide-react";
import { MediaItem } from "../types";

interface TrashViewProps {
  items: MediaItem[];
  isLoading: boolean;
  onRestoreItem: (mediaId: number) => Promise<void>;
  onBulkRestore: (mediaIds: number[]) => Promise<void>;
  onPermanentDelete: (mediaId: number) => Promise<void>;
  onEmptyTrash: () => Promise<void>;
  onRefresh: () => Promise<void>;
}

function formatRelativeTime(isoString?: string | null): string {
  if (!isoString) return "Recently";
  try {
    // Normalize SQLite UTC timestamps: without 'Z', browser parses as local time causing a 7-hour offset!
    const normalized = isoString.includes("Z") || isoString.includes("+")
      ? isoString
      : isoString.replace(" ", "T") + "Z";
    const date = new Date(normalized);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "Recently";
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export const TrashView: React.FC<TrashViewProps> = ({
  items,
  isLoading,
  onRestoreItem,
  onBulkRestore,
  onPermanentDelete,
  onEmptyTrash,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [itemToDeletePermanently, setItemToDeletePermanently] = useState<MediaItem | null>(null);
  const [showEmptyTrashModal, setShowEmptyTrashModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  };

  const handleBulkRestoreClick = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      await onBulkRestore(Array.from(selectedIds));
      setSelectedIds(new Set());
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmptyTrashConfirm = async () => {
    setIsProcessing(true);
    try {
      await onEmptyTrash();
      setSelectedIds(new Set());
      setShowEmptyTrashModal(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePermanentDeleteConfirm = async () => {
    if (!itemToDeletePermanently) return;
    setIsProcessing(true);
    try {
      await onPermanentDelete(itemToDeletePermanently.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemToDeletePermanently.id);
        return next;
      });
      setItemToDeletePermanently(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-7xl mx-auto w-full">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-outline-variant/15 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2.5">
                <span>Trash</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-mono">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </span>
              </h1>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Deleted items are safely retained here. Restore them back to your gallery or empty trash to permanently purge from Telegram.
              </p>
            </div>
          </div>
        </div>

        {/* Global Trash Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {items.length > 0 && (
            <>
              <button
                type="button"
                onClick={selectAll}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-outline-variant/15 text-on-surface hover:bg-white/[0.04] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {selectedIds.size === items.length ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-primary" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 text-on-surface-variant" />
                    <span>Select All</span>
                  </>
                )}
              </button>

              {selectedIds.size > 0 ? (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleBulkRestoreClick}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isProcessing ? "animate-spin" : ""}`} />
                  <span>Restore ({selectedIds.size})</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isProcessing || items.length === 0}
                  onClick={() => setShowEmptyTrashModal(true)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Empty Trash</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-2.5">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div
              key={idx}
              className="aspect-square rounded-xl bg-surface-container-low/50 animate-pulse border border-outline-variant/10"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant/40 mb-3 border border-outline-variant/15">
            <CheckCircle2 className="w-8 h-8 text-emerald-500/70" />
          </div>
          <h3 className="text-base font-semibold text-on-surface">Trash is Empty</h3>
          <p className="text-xs text-on-surface-variant max-w-sm mt-1 leading-relaxed">
            Items you delete from your photos, videos, or albums will appear here for safe recovery.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-2.5">
          {items.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isVideo = item.mime_type.startsWith("video/");

            return (
              <div
                key={item.id}
                onClick={() => toggleSelect(item.id)}
                className={`group relative rounded-xl overflow-hidden bg-surface-container-low/60 border transition-all duration-150 cursor-pointer ${
                  isSelected ? "ring-2 ring-primary border-transparent bg-surface-container-low" : "border-outline-variant/15 hover:border-outline-variant/30"
                }`}
              >
                {/* Media Preview Container */}
                <div className="aspect-square relative overflow-hidden bg-surface-container-lowest">
                  <img
                    src={item.thumbnail_url}
                    alt={item.file_name}
                    loading="lazy"
                    className="w-full h-full object-cover object-center filter grayscale-[25%] group-hover:grayscale-0 transition-all duration-300"
                  />

                  {/* Top Overlay Badge / Select Circle */}
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(item.id);
                      }}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md ${
                        isSelected
                          ? "bg-primary text-on-primary ring-2 ring-primary"
                          : "bg-black/60 backdrop-blur-md border border-white/20 text-transparent hover:text-white"
                      }`}
                    >
                      {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-on-primary" /> : <Square className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Media Type Indicator */}
                  <div className="absolute top-2 right-2 z-10">
                    <span className="p-1 rounded-md bg-black/60 border border-white/20 text-on-surface-variant text-[10px] flex items-center justify-center backdrop-blur-md">
                      {isVideo ? <Film className="w-3 h-3 text-sky-400" /> : <ImageIcon className="w-3 h-3 text-amber-400" />}
                    </span>
                  </div>

                  {/* Hover Quick Action Buttons Bar */}
                  <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/85 via-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between gap-1.5 z-20">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestoreItem(item.id);
                      }}
                      className="flex-1 py-1 px-2 rounded-md text-[11px] font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      title="Restore to gallery"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setItemToDeletePermanently(item);
                      }}
                      className="p-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 flex items-center justify-center cursor-pointer transition-colors"
                      title="Permanently delete from Telegram"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Footer Metadata */}
                <div className="p-2 bg-surface-container-low/80">
                  <p className="text-xs font-medium text-on-surface truncate" title={item.file_name}>
                    {item.file_name}
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-on-surface-variant mt-0.5 font-mono">
                    <span>{formatBytes(item.file_size)}</span>
                    <span className="flex items-center gap-1 text-on-surface-variant/80" title={item.deleted_at || ""}>
                      <Clock className="w-2.5 h-2.5" />
                      {formatRelativeTime(item.deleted_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal: Delete Permanently Single Item */}
      {itemToDeletePermanently && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md p-6 rounded-2xl bg-surface-container-low/95 backdrop-blur-md border border-outline-variant/20 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              </div>
              <h3 className="text-base font-bold text-on-surface">Permanently Delete Item?</h3>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-5">
              Are you sure you want to permanently delete <strong className="text-on-surface">"{itemToDeletePermanently.file_name}"</strong>?
              This will permanently delete the message and media document from your Telegram storage vault. <span className="text-rose-400 font-semibold">This action cannot be undone.</span>
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setItemToDeletePermanently(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handlePermanentDeleteConfirm}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors disabled:opacity-50"
              >
                {isProcessing ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Empty Trash */}
      {showEmptyTrashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md p-6 rounded-2xl bg-surface-container-low/95 backdrop-blur-md border border-outline-variant/20 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <h3 className="text-base font-bold text-on-surface">Empty Entire Trash?</h3>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed mb-5">
              Are you sure you want to permanently delete all <strong className="text-on-surface">{items.length} item(s)</strong> in Trash?
              All corresponding files will be permanently purged from your Telegram storage vault channel. <span className="text-rose-400 font-semibold">This action cannot be undone.</span>
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setShowEmptyTrashModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleEmptyTrashConfirm}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors disabled:opacity-50"
              >
                {isProcessing ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Empty All Trash</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
