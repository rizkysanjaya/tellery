/**
 * =============================================================================
 * Module: frontend/src/components/MediaLightbox.tsx
 * Purpose: Fullscreen modal lightbox with EXIF drawer, keyboard navigation,
 *          zoomable viewport, album/folder assignment manager, and permanent deletion controls.
 *          Updated to match Silk Cloud dark neomorphic design system.
 * Used by: frontend/src/App.tsx
 * Dependencies: lucide-react, frontend/src/types.ts, frontend/src/api.ts, frontend/src/components/VideoPlayer.tsx
 * Public Members: MediaLightbox
 * Side Effects: Listens for window keydown events, executes deletion over HTTP.
 * =============================================================================
 */

import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { MediaItem } from "../types";
import { VideoPlayer } from "./VideoPlayer";

interface MediaLightboxProps {
  item: MediaItem;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onDelete: (id: number) => Promise<void>;
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({
  item,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onDelete,
}) => {
  const [showInfo, setShowInfo] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const isVideo = item.mime_type.startsWith("video/");

  const handleCopyLink = async () => {
    try {
      const fullUrl = `${window.location.origin}${item.stream_url}`;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showDeleteConfirm) return;
      if (e.key === "Escape") onClose();
      if (!isVideo) {
        if (e.key === "ArrowLeft" && hasPrev) onPrev();
        if (e.key === "ArrowRight" && hasNext) onNext();
      }
      if (e.key === "i" || e.key === "I") setShowInfo((prev) => !prev);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasPrev, hasNext, isVideo, onClose, onPrev, onNext, showDeleteConfirm]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(item.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to delete media item.");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "Unknown Date";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("en-US", {
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
      className="fixed inset-0 z-50 bg-background/95 flex flex-col select-none font-sans text-on-surface"
    >
      {/* Top Action Bar */}
      <header className="w-full flex justify-between items-center px-6 py-4 bg-surface-base/90 backdrop-blur-md border-b border-outline-variant/10 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full neo-button flex items-center justify-center text-on-surface hover:text-primary transition-colors cursor-pointer shrink-0"
            title="Back (Esc)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <span className="text-sm font-semibold text-on-surface truncate">
            {item.file_name}
          </span>
        </div>

        <div className="flex gap-2 items-center">
          <button
            onClick={() => setShowInfo((prev) => !prev)}
            className={`w-10 h-10 rounded-full neo-button flex items-center justify-center transition-colors cursor-pointer ${
              showInfo ? "text-primary neo-pressed" : "text-on-surface hover:text-primary"
            }`}
            title="Toggle Info Panel (i)"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        {/* Image/Video Container */}
        <div className="flex-1 p-2 md:p-6 flex items-center justify-center relative bg-surface-container-lowest overflow-hidden">
          {isVideo ? (
            <div className="w-full h-full flex items-center justify-center">
              <VideoPlayer item={item} />
            </div>
          ) : (
            <div className="relative max-w-5xl max-h-[88vh] rounded-neo-xl neo-raised p-2 bg-surface-base flex items-center justify-center">
              <div className="w-full h-full rounded-neo-lg overflow-hidden neo-pressed bg-surface-container-highest relative flex items-center justify-center">
                <motion.img
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  src={item.stream_url}
                  alt={item.file_name}
                  className="object-contain max-h-[84vh] w-auto max-w-full rounded-neo-lg shadow-inner z-0"
                />
              </div>
            </div>
          )}

          {/* Navigation Arrows */}
          {hasPrev && (
            <button
              onClick={onPrev}
              className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-surface-base neo-button flex items-center justify-center text-on-surface hover:text-primary transition-colors z-20 cursor-pointer"
              title="Previous (Left Arrow)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          {hasNext && (
            <button
              onClick={onNext}
              className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-surface-base neo-button flex items-center justify-center text-on-surface hover:text-primary transition-colors z-20 cursor-pointer"
              title="Next (Right Arrow)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Delete Confirmation Modal Overlay */}
          <AnimatePresence>
            {showDeleteConfirm && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="max-w-sm w-full bg-surface-base rounded-neo-xl p-6 neo-card text-center space-y-4 border border-outline-variant/15"
                >
                  <div className="w-12 h-12 rounded-neo-lg bg-red-500/10 text-red-400 flex items-center justify-center mx-auto shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2)]">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-on-surface">Delete Media Item?</h4>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      This will permanently delete <span className="text-on-surface font-semibold">{item.file_name}</span>.
                    </p>
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={isDeleting}
                      className="flex-1 px-4 py-2 neo-button rounded-neo-lg text-on-surface text-xs font-semibold transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 active:scale-95 disabled:opacity-50 rounded-neo-lg text-xs font-semibold transition-all cursor-pointer"
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
        <aside className={`w-full md:w-80 bg-surface-base flex-col gap-6 p-6 neo-raised md:shadow-[-6px_0_12px_rgba(0,0,0,0.05)] z-10 shrink-0 overflow-y-auto ${showInfo ? 'flex' : 'hidden md:flex'}`}>
          {/* File Meta */}
          <div className="flex flex-col gap-1 px-2">
            <h2 className="text-xl font-semibold text-on-surface break-words">{item.file_name}</h2>
            <p className="text-sm text-on-surface-variant">{formatDate(item.date_taken)} • {formatBytes(item.file_size)}</p>
          </div>

          {/* Action Grid (Download, Copy Link, Delete) */}
          <div className="grid grid-cols-3 gap-3 mt-2">
            <a
              href={item.stream_url}
              download={item.file_name}
              className="flex flex-col md:flex-row items-center justify-center gap-2 p-3 rounded-neo-xl bg-surface-base neo-button text-on-surface hover:text-primary transition-all text-center cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span className="text-xs font-semibold">Download</span>
            </a>
            <button
              onClick={handleCopyLink}
              className="flex flex-col md:flex-row items-center justify-center gap-2 p-3 rounded-neo-xl bg-surface-base neo-button text-on-surface hover:text-primary transition-all text-center cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Share2 className="w-4 h-4" />}
              <span className="text-xs font-semibold">{copied ? "Copied!" : "Share"}</span>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex flex-col md:flex-row items-center justify-center gap-2 p-3 rounded-neo-xl bg-surface-base neo-button text-red-400 hover:text-red-300 transition-all text-center cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-xs font-semibold">Delete</span>
            </button>
          </div>

          {/* Details Section */}
          <div className="mt-auto md:mt-6 rounded-neo-xl bg-surface-container-low p-4 neo-pressed border border-white/[0.02]">
            <h3 className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" /> Details
            </h3>
            <div className="space-y-3 text-sm">
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
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Format</span>
                <span className="text-on-surface font-medium uppercase">{item.mime_type.split('/').pop()}</span>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </motion.div>
  );
};
