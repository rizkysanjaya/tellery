/**
 * =============================================================================
 * Module: frontend/src/components/MediaLightbox.tsx
 * Purpose: Fullscreen modal lightbox with EXIF drawer, keyboard navigation,
 *          zoomable viewport, album/folder assignment manager, and permanent deletion controls.
 *          Updated to match Silk Cloud dark neomorphic design system.
 * Used by: frontend/src/App.tsx
 * Dependencies: lucide-react, frontend/src/types.ts, frontend/src/api.ts, frontend/src/components/VideoPlayer.tsx
 * Public Members: MediaLightbox
 * Side Effects: Listens for window keydown events, executes folder membership changes and deletion over HTTP.
 * =============================================================================
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Download,
  Trash2,
  AlertTriangle,
  Loader2,
  Check,
  ArrowLeft,
  Cloud,
  MoreVertical,
  Heart,
  Share2,
} from "lucide-react";
import { FolderItem, MediaItem } from "../types";
import { addMediaToFolder, fetchMediaFolders, removeMediaFromFolder } from "../api";
import { VideoPlayer } from "./VideoPlayer";

interface MediaLightboxProps {
  item: MediaItem;
  allFolders: FolderItem[];
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onDelete: (id: number) => Promise<void>;
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({
  item,
  allFolders,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onDelete,
}) => {
  const [showInfo, setShowInfo] = useState(true);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [assignedFolderIds, setAssignedFolderIds] = useState<number[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isVideo = item.mime_type.startsWith("video/");

  // Load assigned folders for current media item
  useEffect(() => {
    let isMounted = true;
    setLoadingFolders(true);
    fetchMediaFolders(item.id)
      .then((folders) => {
        if (isMounted) {
          setAssignedFolderIds(folders.map((f) => f.id));
          setLoadingFolders(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (isMounted) setLoadingFolders(false);
      });
    return () => {
      isMounted = false;
    };
  }, [item.id]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showDeleteConfirm || showFolderMenu) return;
      if (e.key === "Escape") onClose();
      if (!isVideo) {
        if (e.key === "ArrowLeft" && hasPrev) onPrev();
        if (e.key === "ArrowRight" && hasNext) onNext();
      }
      if (e.key === "i" || e.key === "I") setShowInfo((prev) => !prev);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPrev, onNext, hasPrev, hasNext, showDeleteConfirm, showFolderMenu, isVideo]);

  const handleToggleFolder = async (folderId: number) => {
    const isCurrentlyIn = assignedFolderIds.includes(folderId);
    try {
      if (isCurrentlyIn) {
        await removeMediaFromFolder(folderId, item.id);
        setAssignedFolderIds((prev) => prev.filter((id) => id !== folderId));
      } else {
        await addMediaToFolder(folderId, [item.id]);
        setAssignedFolderIds((prev) => [...prev, folderId]);
      }
    } catch (err) {
      console.error("Failed to update folder membership", err);
      alert("Failed to update folder assignment.");
    }
  };

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
      return d.toLocaleDateString(undefined, {
        dateStyle: "long",
        timeStyle: "short",
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
      <header className="w-full flex justify-between items-center px-6 py-4 bg-surface-base shadow-[6px_6px_12px_rgba(0,0,0,0.08),-6px_-6px_12px_rgba(255,255,255,0.05)] z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full neo-button flex items-center justify-center text-on-surface hover:scale-[1.02] transition-transform duration-200 cursor-pointer"
            title="Back (Esc)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 text-on-surface-variant font-medium">
            <Cloud className="w-4 h-4" />
            <span className="text-sm">Synced</span>
          </div>
        </div>

        <div className="flex gap-3 relative items-center">
          <button
            onClick={() => setShowInfo((prev) => !prev)}
            className={`w-10 h-10 rounded-full neo-button flex items-center justify-center transition-transform duration-200 cursor-pointer ${
              showInfo ? "text-primary neo-pressed" : "text-on-surface hover:scale-[1.02]"
            }`}
            title="Toggle Info Panel (i)"
          >
            <Info className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowFolderMenu((prev) => !prev)}
            className="w-10 h-10 rounded-full neo-button flex items-center justify-center text-on-surface hover:scale-[1.02] transition-transform duration-200 cursor-pointer"
            title="More Options"
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {/* Folder Assignment Dropdown (Moved to kebab for preservation) */}
          <AnimatePresence>
            {showFolderMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-64 bg-surface-container border border-white/[0.05] rounded-neo-lg p-3 shadow-[10px_10px_20px_#060910,-5px_-5px_15px_rgba(30,41,59,0.5)] z-50"
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.05]">
                  <span className="text-xs font-bold text-on-surface">Organize in Collection</span>
                  <button
                    onClick={() => setShowFolderMenu(false)}
                    className="p-1 text-on-surface-variant hover:text-on-surface rounded-md cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {loadingFolders ? (
                  <div className="py-4 text-center">
                    <Loader2 className="w-4 h-4 text-primary animate-spin mx-auto" />
                  </div>
                ) : allFolders.length === 0 ? (
                  <p className="text-xs text-on-surface-variant py-3 text-center">No collections created yet.</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {allFolders.map((folder) => {
                      const isChecked = assignedFolderIds.includes(folder.id);
                      return (
                        <button
                          key={folder.id}
                          onClick={() => handleToggleFolder(folder.id)}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-neo text-xs font-medium transition-all text-left cursor-pointer ${
                            isChecked
                              ? "bg-primary/10 text-primary neo-pressed font-semibold"
                              : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                          }`}
                        >
                          <span className="truncate">{folder.name}</span>
                          {isChecked && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        {/* Image/Video Container */}
        <div className="flex-1 p-6 md:p-12 flex items-center justify-center relative bg-surface-container-lowest">
          <div className="relative w-full max-w-5xl aspect-auto max-h-[85vh] rounded-neo-xl neo-raised p-2 bg-surface-base">
            <div className="w-full h-full rounded-neo-lg overflow-hidden neo-pressed bg-surface-container-highest relative flex items-center justify-center">
              {isVideo ? (
                <VideoPlayer item={item} />
              ) : (
                <motion.img
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  src={item.stream_url}
                  alt={item.file_name}
                  className="object-contain w-full h-full rounded-neo-lg shadow-inner z-0"
                />
              )}
            </div>
          </div>

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
                  className="max-w-sm w-full bg-surface-base rounded-neo-xl p-6 shadow-[10px_10px_20px_#060910,-5px_-5px_15px_rgba(30,41,59,0.5)] text-center space-y-4 border-t border-l border-white/[0.05]"
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

          {/* Action Grid */}
          <div className="grid grid-cols-4 md:grid-cols-2 gap-4 mt-2">
            <a
              href={item.stream_url}
              download={item.file_name}
              className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 p-3 md:p-4 rounded-neo-xl bg-surface-base neo-button text-on-surface hover:text-primary transition-all"
            >
              <Download className="w-5 h-5" />
              <span className="text-xs md:text-sm font-medium">Download</span>
            </a>
            <button className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 p-3 md:p-4 rounded-neo-xl bg-surface-base neo-button text-on-surface hover:text-primary transition-all">
              <Share2 className="w-5 h-5" />
              <span className="text-xs md:text-sm font-medium">Share</span>
            </button>
            <button className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 p-3 md:p-4 rounded-neo-xl bg-surface-base neo-pressed text-primary transition-all">
              <Heart className="w-5 h-5 fill-primary" />
              <span className="text-xs md:text-sm font-medium">Favorite</span>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 p-3 md:p-4 rounded-neo-xl bg-surface-base neo-button text-red-400 hover:text-red-300 transition-all"
            >
              <Trash2 className="w-5 h-5" />
              <span className="text-xs md:text-sm font-medium">Delete</span>
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
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/[0.05]">
                <span className="text-on-surface-variant flex items-center gap-1">
                  <Cloud className="w-3.5 h-3.5" /> Backend
                </span>
                <span className="text-primary font-medium text-xs">MTProto Vault</span>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </motion.div>
  );
};
