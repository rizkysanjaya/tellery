/**
 * =============================================================================
 * Module: frontend/src/components/MediaLightbox.tsx
 * Purpose: Fullscreen modal lightbox with EXIF drawer, keyboard navigation,
 *          zoomable viewport, album/folder assignment manager, and permanent deletion controls.
 * Used by: frontend/src/App.tsx
 * Dependencies: lucide-react, frontend/src/types.ts, frontend/src/api.ts, frontend/src/components/VideoPlayer.tsx
 * Public Members: MediaLightbox
 * Side Effects: Listens for window keydown events, executes folder membership changes and deletion over HTTP.
 * =============================================================================
 */

import React, { useEffect, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Download,
  Calendar,
  Camera,
  Maximize2,
  HardDrive,
  FileCode,
  Trash2,
  AlertTriangle,
  Loader2,
  FolderPlus,
  Check,
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
  const [showInfo, setShowInfo] = useState(false);
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
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
      if (e.key === "i" || e.key === "I") setShowInfo((prev) => !prev);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPrev, onNext, hasPrev, hasNext, showDeleteConfirm, showFolderMenu]);

  const handleToggleFolder = async (folderId: number) => {
    const isAssigned = assignedFolderIds.includes(folderId);
    if (isAssigned) {
      setAssignedFolderIds((prev) => prev.filter((id) => id !== folderId));
      await removeMediaFromFolder(folderId, item.id).catch(console.error);
    } else {
      setAssignedFolderIds((prev) => [...prev, folderId]);
      await addMediaToFolder(folderId, [item.id]).catch(console.error);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(item.id);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "Unknown";
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col select-none animate-in fade-in duration-200">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-3.5 bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="truncate max-w-[180px] sm:max-w-md">
            <h3 className="text-sm font-semibold text-white truncate">{item.file_name}</h3>
            <p className="text-xs text-zinc-400">{formatDate(item.date_taken)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 relative">
          {/* Add to Album / Folder Menu Button */}
          <button
            onClick={() => setShowFolderMenu((prev) => !prev)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              showFolderMenu ? "bg-sky-500 text-white" : "hover:bg-white/10 text-zinc-300 hover:text-white"
            }`}
            title="Organize in Albums"
          >
            <FolderPlus className="w-5 h-5" />
          </button>

          {/* Folder Assignment Dropdown */}
          {showFolderMenu && (
            <div className="absolute right-24 top-12 w-64 bg-zinc-900 border border-zinc-800 rounded-2xl p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800">
                <span className="text-xs font-bold text-white">Add to Albums</span>
                <button
                  onClick={() => setShowFolderMenu(false)}
                  className="p-1 text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {loadingFolders ? (
                <div className="py-4 text-center">
                  <Loader2 className="w-4 h-4 text-sky-400 animate-spin mx-auto" />
                </div>
              ) : allFolders.length === 0 ? (
                <p className="text-xs text-zinc-500 py-3 text-center">No albums created yet.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {allFolders.map((folder) => {
                    const isChecked = assignedFolderIds.includes(folder.id);
                    return (
                      <button
                        key={folder.id}
                        onClick={() => handleToggleFolder(folder.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                          isChecked
                            ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                            : "text-zinc-300 hover:bg-zinc-800"
                        }`}
                      >
                        <span className="truncate">{folder.name}</span>
                        {isChecked && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Download Original */}
          <a
            href={item.stream_url}
            download={item.file_name}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Download Original"
          >
            <Download className="w-5 h-5" />
          </a>

          {/* Delete Media */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-full hover:bg-red-500/20 text-zinc-300 hover:text-red-400 transition-colors cursor-pointer"
            title="Delete Media"
          >
            <Trash2 className="w-5 h-5" />
          </button>

          {/* Toggle EXIF Drawer */}
          <button
            onClick={() => setShowInfo((prev) => !prev)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              showInfo ? "bg-sky-500 text-white" : "hover:bg-white/10 text-zinc-300 hover:text-white"
            }`}
            title="Toggle Metadata Info (I)"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {/* Navigation Arrows */}
        {hasPrev && (
          <button
            onClick={onPrev}
            className="absolute left-4 z-20 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white backdrop-blur-md border border-white/10 transition-all hover:scale-105 cursor-pointer"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {hasNext && (
          <button
            onClick={onNext}
            className="absolute right-4 z-20 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white backdrop-blur-md border border-white/10 transition-all hover:scale-105 cursor-pointer"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Media Renderer */}
        <div className="w-full h-full flex items-center justify-center p-4">
          {isVideo ? (
            <VideoPlayer item={item} />
          ) : (
            <img
              src={item.stream_url}
              alt={item.file_name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl transition-all"
            />
          )}
        </div>

        {/* Delete Confirmation Modal Overlay */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="max-w-sm w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Delete Media Item?</h4>
                <p className="text-xs text-zinc-400 mt-1">
                  This will permanently delete <span className="text-zinc-200 font-semibold">{item.file_name}</span> from your Telegram Vault storage channel and local database.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-red-600/20 transition-all cursor-pointer"
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>{isDeleting ? "Deleting..." : "Delete"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* EXIF & Technical Metadata Drawer */}
        {showInfo && (
          <aside className="absolute right-0 top-0 bottom-0 w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800 p-6 overflow-y-auto z-30 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-400" />
                Technical Metadata
              </h4>
              <button
                onClick={() => setShowInfo(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-6 space-y-5 text-xs">
              {/* Date Taken */}
              <div>
                <span className="text-zinc-500 font-medium flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  Date Captured
                </span>
                <p className="text-zinc-200 font-semibold">{formatDate(item.date_taken)}</p>
              </div>

              {/* Camera Model */}
              {(item.camera_make || item.camera_model) && (
                <div>
                  <span className="text-zinc-500 font-medium flex items-center gap-1.5 mb-1">
                    <Camera className="w-3.5 h-3.5 text-sky-400" />
                    Camera Device
                  </span>
                  <p className="text-zinc-200 font-semibold">
                    {[item.camera_make, item.camera_model].filter(Boolean).join(" ")}
                  </p>
                </div>
              )}

              {/* Dimensions */}
              {item.width && item.height && (
                <div>
                  <span className="text-zinc-500 font-medium flex items-center gap-1.5 mb-1">
                    <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                    Resolution
                  </span>
                  <p className="text-zinc-200 font-semibold">
                    {item.width} × {item.height} px
                  </p>
                </div>
              )}

              {/* File Size */}
              <div>
                <span className="text-zinc-500 font-medium flex items-center gap-1.5 mb-1">
                  <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                  File Size
                </span>
                <p className="text-zinc-200 font-semibold">{formatBytes(item.file_size)}</p>
              </div>

              {/* MIME Type */}
              <div>
                <span className="text-zinc-500 font-medium flex items-center gap-1.5 mb-1">
                  <FileCode className="w-3.5 h-3.5 text-sky-400" />
                  Format / MIME
                </span>
                <p className="text-zinc-200 font-semibold font-mono">{item.mime_type}</p>
              </div>

              {/* Storage Info */}
              <div className="pt-4 border-t border-zinc-800">
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold">
                  Storage Backend
                </span>
                <div className="mt-2 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                  <p className="text-sky-400 font-semibold">Telegram MTProto Vault</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Original uncompressed raw document
                  </p>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
