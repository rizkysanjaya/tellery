/**
 * =============================================================================
 * Module: frontend/src/components/MediaLightbox.tsx
 * Purpose: Fullscreen modal lightbox with EXIF drawer, keyboard navigation,
 *          borderless floating photo canvas, 1-click favorite toggle,
 *          accessible 44px+ mobile touch targets, and deletion controls.
 *          Supports permission gating (hiding Delete action when active vault is read-only).
 * Used by: frontend/src/App.tsx
 * Dependencies: lucide-react, frontend/src/types.ts, frontend/src/api.ts, frontend/src/components/VideoPlayer.tsx
 * Public Members: MediaLightbox
 * Side Effects: Listens for window keydown events, executes deletion and favorite toggle callbacks.
 * =============================================================================
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Download,
  Trash2,
  AlertTriangle,
  Loader2,
  Check,
  ArrowLeft,
  Share2,
  Star,
} from "lucide-react";
import { MediaItem } from "../types";
import { VideoPlayer } from "./VideoPlayer";
import { getFileTypeBadge } from "../utils/fileTypes";

interface MediaLightboxProps {
  item: MediaItem;
  prevItem?: MediaItem;
  nextItem?: MediaItem;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onToggleFavorite?: (id: number, isFavorite: boolean) => void;
  onDelete?: (id: number) => Promise<void>;
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({
  item,
  prevItem,
  nextItem,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onToggleFavorite,
  onDelete,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [showNavButtons, setShowNavButtons] = useState(true);
  const navTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileBadge = getFileTypeBadge(item.file_name, item.mime_type);
  const isVideo = item.mime_type.startsWith("video/") || fileBadge.category === "video";

  const resetNavTimer = useCallback(() => {
    setShowNavButtons(true);
    if (navTimerRef.current) {
      clearTimeout(navTimerRef.current);
    }
    navTimerRef.current = setTimeout(() => {
      setShowNavButtons(false);
    }, 2800);
  }, []);

  useEffect(() => {
    resetNavTimer();
    const handleActivity = () => resetNavTimer();
    window.addEventListener("mousemove", handleActivity, { passive: true });
    window.addEventListener("touchstart", handleActivity, { passive: true });

    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
    };
  }, [resetNavTimer]);

  useEffect(() => {
    setIsImageLoaded(false);
  }, [item.id, item.stream_url]);

  // Proactive Adjacent Pre-Fetching (Pre-loads previous and next photos into browser cache)
  useEffect(() => {
    const targets = [nextItem, prevItem].filter(Boolean) as MediaItem[];
    for (const target of targets) {
      const targetBadge = getFileTypeBadge(target.file_name, target.mime_type);
      const targetIsVideo = target.mime_type.startsWith("video/") || targetBadge.category === "video";
      if (!targetIsVideo) {
        const img = new Image();
        img.src = target.stream_url;
      }
    }
  }, [nextItem, prevItem]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else {
          onClose();
        }
      } else if (e.key === "ArrowLeft" && hasPrev) {
        onPrev();
      } else if (e.key === "ArrowRight" && hasNext) {
        onNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPrev, onNext, hasPrev, hasNext, showDeleteConfirm]);

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(item.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error("Failed to delete media item:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + item.stream_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return "Unknown date";
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col select-none font-sans text-on-surface"
    >
      {/* Top Action Bar */}
      <header className="w-full flex justify-between items-center px-4 sm:px-6 py-3 bg-surface-container-low/80 backdrop-blur-md border-b border-outline-variant/15 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0 touch-manipulation"
            title="Back (Esc)"
            aria-label="Back to gallery (Esc)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <span className="text-sm font-semibold text-on-surface truncate">
            {item.file_name}
          </span>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        {/* Image/Video Container */}
        <div className="flex-1 p-2 md:p-6 flex items-center justify-center relative bg-black/40 overflow-hidden">
          {isVideo ? (
            <div className="w-full h-full flex items-center justify-center">
              <VideoPlayer key={item.id} item={item} />
            </div>
          ) : (
            <div className="relative max-w-6xl max-h-[88vh] flex items-center justify-center min-w-[320px] min-h-[320px]">
              {/* GIF Animation Pill Indicator */}
              {(item.mime_type === "image/gif" || item.file_name.toLowerCase().endsWith(".gif")) && (
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/70 border border-primary/40 text-primary text-xs font-bold tracking-wider uppercase z-20 shadow-md backdrop-blur-xs flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span>GIF Animation</span>
                </div>
              )}

              {/* Instant Low-Res / High-Res Thumbnail Base Layer (0ms visual rendering) */}
              {item.thumbnail_url && !isImageLoaded && !(item.mime_type === "image/gif" || item.file_name.toLowerCase().endsWith(".gif")) && (
                <img
                  src={item.thumbnail_url}
                  alt={item.file_name}
                  className="absolute inset-0 w-full h-full object-contain filter blur-[2px] opacity-75 z-0"
                />
              )}

              {!isImageLoaded && !item.thumbnail_url && !(item.mime_type === "image/gif" || item.file_name.toLowerCase().endsWith(".gif")) && (
                <div className="absolute inset-0 flex items-center justify-center bg-transparent z-10">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                </div>
              )}

              <motion.img
                key={item.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{
                  opacity: (isImageLoaded || item.mime_type === "image/gif" || item.file_name.toLowerCase().endsWith(".gif")) ? 1 : 0,
                  scale: (isImageLoaded || item.mime_type === "image/gif" || item.file_name.toLowerCase().endsWith(".gif")) ? 1 : 0.98
                }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                src={item.stream_url}
                alt={item.file_name}
                onLoad={() => setIsImageLoaded(true)}
                className="relative object-contain max-h-[84vh] w-auto max-w-full rounded-lg shadow-2xl z-10"
              />
            </div>
          )}

          {/* Navigation Arrows */}
          {hasPrev && (
            <div
              className={`absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-20 transition-all duration-300 ${
                showNavButtons
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 -translate-x-4 pointer-events-none"
              }`}
            >
              <button
                onClick={onPrev}
                className="w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer shadow-lg active:scale-95 touch-manipulation"
                title="Previous (Left Arrow)"
                aria-label="Previous item (Left Arrow)"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            </div>
          )}
          {hasNext && (
            <div
              className={`absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-20 transition-all duration-300 ${
                showNavButtons
                  ? "opacity-100 translate-x-0"
                  : "opacity-0 translate-x-4 pointer-events-none"
              }`}
            >
              <button
                onClick={onNext}
                className="w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer shadow-lg active:scale-95 touch-manipulation"
                title="Next (Right Arrow)"
                aria-label="Next item (Right Arrow)"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          )}

          {/* Delete Confirmation Modal Overlay */}
          <AnimatePresence>
            {showDeleteConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="max-w-sm w-full bg-surface-container-low/95 backdrop-blur-md rounded-2xl p-6 text-center space-y-4 border border-outline-variant/20 shadow-2xl"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-on-surface">Delete Media Item?</h4>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      This will permanently delete <span className="text-on-surface font-semibold">{item.file_name}</span>.
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="flex-1 px-3.5 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 disabled:opacity-50 rounded-lg text-xs font-semibold text-white shadow-sm transition-all cursor-pointer"
                    >
                      {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span>{isDeleting ? "Deleting..." : "Delete"}</span>
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info Panel (Right Side Desktop / Bottom Mobile) */}
        <aside className="w-full md:w-80 bg-surface-container-low/60 border-l border-outline-variant/15 flex flex-col gap-6 p-6 z-10 shrink-0 overflow-y-auto animate-in fade-in duration-200">
          {/* File Meta */}
          <div className="flex flex-col gap-1 px-1">
            <h2 className="text-base font-semibold text-on-surface break-words">{item.file_name}</h2>
            <p className="text-xs text-on-surface-variant">{formatDate(item.date_taken)} • {formatBytes(item.file_size)}</p>
          </div>

          {/* Action Grid (Download, Share, Favorite, Delete) */}
          <div className="grid grid-cols-4 gap-2">
            <a
              href={item.stream_url}
              download={item.file_name}
              className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/15 hover:border-outline-variant/30 hover:bg-surface-container-lowest text-on-surface transition-all text-center cursor-pointer touch-manipulation"
              title="Download"
              aria-label="Download file"
            >
              <Download className="w-4 h-4" />
              <span className="text-[11px] font-medium">Save</span>
            </a>
            <button
              onClick={handleCopyLink}
              className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/15 hover:border-outline-variant/30 hover:bg-surface-container-lowest text-on-surface transition-all text-center cursor-pointer touch-manipulation"
              title="Share Link"
              aria-label="Share media link"
            >
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Share2 className="w-4 h-4" />}
              <span className="text-[11px] font-medium">{copied ? "Copied!" : "Share"}</span>
            </button>
            <button
              onClick={() => {
                if (onToggleFavorite) {
                  onToggleFavorite(item.id, !item.is_favorite);
                }
              }}
              className={`flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/15 hover:border-outline-variant/30 hover:bg-surface-container-lowest transition-all text-center cursor-pointer touch-manipulation ${
                item.is_favorite ? "text-amber-400" : "text-on-surface hover:text-amber-400"
              }`}
              title={item.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
              aria-label={item.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
            >
              <Star className={`w-4 h-4 ${item.is_favorite ? "fill-amber-400 text-amber-400" : ""}`} />
              <span className="text-[11px] font-medium">{item.is_favorite ? "Starred" : "Star"}</span>
            </button>
            {onDelete && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/15 hover:border-rose-500/30 hover:bg-rose-500/10 text-rose-400 transition-all text-center cursor-pointer touch-manipulation"
                title="Delete"
                aria-label="Delete media item"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-[11px] font-medium">Delete</span>
              </button>
            )}
          </div>

          {/* Details Section */}
          <div className="mt-auto md:mt-4 rounded-xl bg-surface-container-lowest/80 p-4 border border-outline-variant/15">
            <h3 className="text-xs font-semibold text-on-surface mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" /> Details
            </h3>
            <div className="space-y-2.5 text-xs">
              {(item.camera_make || item.camera_model) && (
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Camera</span>
                  <span className="text-on-surface font-medium text-right max-w-[120px] truncate">
                    {[item.camera_make, item.camera_model].filter(Boolean).join(" ")}
                  </span>
                </div>
              )}
              {item.width && item.height && (
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Resolution</span>
                  <span className="text-on-surface font-medium">{item.width} × {item.height}</span>
                </div>
              )}
              {Boolean(item.duration_seconds || isVideo) && (
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Duration</span>
                  <span className="text-on-surface font-medium">
                    {formatDuration(item.duration_seconds || 0)}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Format</span>
                {(() => {
                  const badge = getFileTypeBadge(item.file_name, item.mime_type);
                  return (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase font-mono ${badge.pillClass}`}>
                      {badge.extension}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
        </aside>
      </main>
    </motion.div>
  );
};
