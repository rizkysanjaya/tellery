/**
 * =============================================================================
 * Module: frontend/src/components/SelectionToolbar.tsx
 * Purpose: Precision floating action dock shown when 1+ media items are selected.
 *          Provides bulk operations: Add to Album, Favorite, Download ZIP, Move to Trash, Deselect.
 *          Supports permission gating, mobile touch targets, touch-manipulation, WCAG 2.2 AA visible
 *          focus rings, and aria-live polite screen reader counter announcements.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, framer-motion, lucide-react, frontend/src/types.ts
 * Public Members: SelectionToolbar
 * Side Effects: Triggers bulk album assignment, bulk favorite toggling, batch ZIP download, deletion, and deselection callbacks.
 * =============================================================================
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderPlus,
  Trash2,
  X,
  Loader2,
  Check,
  Plus,
  Star,
  Download,
} from "lucide-react";
import { FolderItem } from "../types";

interface SelectionToolbarProps {
  selectedCount: number;
  folders: FolderItem[];
  onAddToFolder: (folderId: number) => Promise<void>;
  onCreateFolderAndAdd: (name: string) => Promise<void>;
  onFavoriteSelected?: () => Promise<void>;
  onDownloadSelected?: () => Promise<void>;
  onDeleteSelected?: () => Promise<void>;
  onDeselectAll: () => void;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
  selectedCount,
  folders,
  onAddToFolder,
  onCreateFolderAndAdd,
  onFavoriteSelected,
  onDownloadSelected,
  onDeleteSelected,
  onDeselectAll,
}) => {
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showNewAlbumInput, setShowNewAlbumInput] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleAddToFolder = async (folderId: number) => {
    setIsProcessing(true);
    try {
      await onAddToFolder(folderId);
      setShowFolderPicker(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newAlbumName.trim()) return;
    setIsProcessing(true);
    try {
      await onCreateFolderAndAdd(newAlbumName.trim());
      setNewAlbumName("");
      setShowNewAlbumInput(false);
      setShowFolderPicker(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!onDeleteSelected) return;
    setIsProcessing(true);
    try {
      await onDeleteSelected();
      setShowDeleteConfirm(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="selection-toolbar bg-surface-container-low/95 backdrop-blur-md rounded-xl px-2 py-1.5 flex items-center gap-1.5 select-none shadow-2xl border border-outline-variant/25 pointer-events-auto"
        >
          {/* Selected Count */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="flex items-center gap-1.5 px-2.5 py-1 bg-primary text-on-primary rounded-lg shadow-xs"
          >
            <Check className="w-3.5 h-3.5 text-on-primary" strokeWidth={2.5} />
            <span className="text-xs font-semibold font-mono whitespace-nowrap">
              {selectedCount} selected
            </span>
          </div>

          {/* Separator */}
          <div className="h-4 w-px bg-outline-variant/20" />

          {/* Add to Album */}
          <div className="relative">
            <button
              onClick={() => {
                setShowFolderPicker((p) => !p);
                setShowDeleteConfirm(false);
              }}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 min-h-[38px] sm:min-h-[32px] min-w-[38px] sm:min-w-0 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06] rounded-lg text-xs font-medium transition-colors cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
              title="Add to Album"
              aria-label="Add to Album"
            >
              <FolderPlus className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Add to Album</span>
            </button>

            {/* Album Picker Dropdown */}
            <AnimatePresence>
              {showFolderPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 mb-2 w-64 bg-surface-container-low border border-outline-variant/20 rounded-xl p-3 z-50 shadow-2xl backdrop-blur-md"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline-variant/15">
                    <span className="text-xs font-semibold text-on-surface">Choose Collection</span>
                    <button
                      onClick={() => setShowFolderPicker(false)}
                      className="p-1 min-w-[28px] min-h-[28px] flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06] rounded-md cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
                      aria-label="Close picker"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-0.5 mb-2">
                    {folders.length === 0 && !showNewAlbumInput && (
                      <p className="text-[11px] text-on-surface-variant/60 py-3 text-center">No collections yet</p>
                    )}
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => handleAddToFolder(folder.id)}
                        disabled={isProcessing}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium text-on-surface hover:bg-white/[0.04] transition-colors text-left cursor-pointer disabled:opacity-50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
                      >
                        <span className="truncate">{folder.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant/70 font-mono">
                          {folder.item_count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* New Album Inline Input */}
                  {showNewAlbumInput ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleCreateAndAdd();
                      }}
                      className="flex items-center gap-1.5 pt-2 border-t border-outline-variant/15"
                    >
                      <input
                        type="text"
                        value={newAlbumName}
                        onChange={(e) => setNewAlbumName(e.target.value)}
                        placeholder="Collection name..."
                        autoFocus
                        className="flex-1 px-2.5 py-1.5 bg-surface-container-lowest border border-outline-variant/20 rounded-md text-xs text-on-surface placeholder-on-surface-variant/50 outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      />
                      <button
                        type="submit"
                        disabled={isProcessing || !newAlbumName.trim()}
                        className="p-1.5 bg-primary text-on-primary hover:bg-primary/90 rounded-md cursor-pointer disabled:opacity-50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setShowNewAlbumInput(true)}
                      className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-primary hover:bg-white/[0.04] transition-colors cursor-pointer mt-1 focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create New Collection</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Favorite Selected */}
          {onFavoriteSelected && (
            <button
              onClick={onFavoriteSelected}
              disabled={isProcessing}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 min-h-[38px] sm:min-h-[32px] min-w-[38px] sm:min-w-0 text-amber-400 hover:bg-amber-500/10 rounded-lg text-xs font-medium transition-colors cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-amber-400 focus-visible:outline-none"
              title="Add Selected to Favorites"
              aria-label="Add selected to Favorites"
            >
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="hidden sm:inline">Favorite</span>
            </button>
          )}

          {/* Download Selected as ZIP */}
          {onDownloadSelected && (
            <button
              onClick={onDownloadSelected}
              disabled={isProcessing}
              className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 min-h-[38px] sm:min-h-[32px] min-w-[38px] sm:min-w-0 text-sky-400 hover:bg-sky-500/10 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 touch-manipulation focus-visible:ring-1 focus-visible:ring-sky-400 focus-visible:outline-none"
              title="Download selected as ZIP archive"
              aria-label="Download selected as ZIP archive"
            >
              <Download className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Download ZIP</span>
            </button>
          )}

          {/* Delete Selected (only if user has delete permissions) */}
          {onDeleteSelected && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowDeleteConfirm((p) => !p);
                  setShowFolderPicker(false);
                }}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 min-h-[38px] sm:min-h-[32px] min-w-[38px] sm:min-w-0 text-rose-400 hover:bg-rose-500/10 rounded-lg text-xs font-medium transition-colors cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-rose-400 focus-visible:outline-none"
                title="Move Selected to Trash"
                aria-label="Move selected to Trash"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Delete</span>
              </button>

              {/* Delete Confirm Popup */}
              <AnimatePresence>
                {showDeleteConfirm && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full right-0 mb-2 w-64 bg-surface-container-low border border-rose-500/30 rounded-xl p-3.5 z-50 shadow-2xl backdrop-blur-md"
                  >
                    <p className="text-xs text-on-surface-variant mb-3 leading-relaxed">
                      Move <span className="text-on-surface font-bold">{selectedCount}</span> item{selectedCount === 1 ? "" : "s"} to Trash? You can restore them anytime.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 px-3 py-1.5 min-h-[34px] bg-surface-container hover:bg-surface-container-high text-on-surface rounded-md text-xs font-medium cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 min-h-[34px] bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-md text-xs font-medium cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-rose-400 focus-visible:outline-none transition-colors"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                        <span>Delete</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Separator */}
          <div className="h-4 w-px bg-outline-variant/20" />

          {/* Deselect All */}
          <button
            onClick={onDeselectAll}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 min-h-[38px] sm:min-h-[32px] min-w-[38px] sm:min-w-0 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06] rounded-lg text-xs font-medium transition-colors cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
            title="Deselect All (Esc)"
            aria-label="Deselect all (Esc)"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Deselect</span>
            <kbd className="hidden md:inline text-[9px] px-1 py-0.2 rounded bg-surface-container border border-outline-variant/15 text-on-surface-variant/70 font-mono">
              Esc
            </kbd>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

