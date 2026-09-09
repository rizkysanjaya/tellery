/**
 * =============================================================================
 * Module: frontend/src/components/SelectionToolbar.tsx
 * Purpose: 21st.dev Floating Dynamic Island action dock shown when 1+ media items
 *          are selected. Provides bulk operations: Add to Album, Favorite, Download ZIP, Move to Trash, Deselect.
 *          Supports permission gating, 44px+ mobile touch targets, touch-manipulation, WCAG 2.2 AA visible
 *          focus rings, and aria-live polite screen reader counter announcements.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
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
          className="selection-toolbar neo-raised bg-surface-base rounded-neo-xl px-2.5 py-2 flex items-center gap-2 select-none shadow-2xl border border-white/[0.05] pointer-events-auto"
        >
          {/* Selected Count */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="flex items-center gap-2 px-3 py-1.5 bg-primary-container text-on-primary rounded-full"
          >
            <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-3 h-3 text-on-primary" strokeWidth={3} />
            </div>
            <span className="text-xs font-medium font-mono whitespace-nowrap">
              {selectedCount} selected
            </span>
          </div>

          {/* Separator */}
          <div className="h-5 w-px bg-outline-variant/50" />

          {/* Add to Album */}
          <div className="relative">
            <button
              onClick={() => {
                setShowFolderPicker((p) => !p);
                setShowDeleteConfirm(false);
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[42px] sm:min-h-[36px] min-w-[42px] sm:min-w-0 neo-button text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-neo text-xs font-medium transition-all cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              title="Add to Album"
              aria-label="Add to Album"
            >
              <FolderPlus className="w-4 h-4 text-primary" />
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
                  className="absolute bottom-full left-0 mb-3 w-64 neo-card bg-surface-base rounded-neo-lg p-3 z-50"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-surface-container-highest">
                    <span className="text-xs font-bold text-on-surface">Choose Collection</span>
                    <button
                      onClick={() => setShowFolderPicker(false)}
                      className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center text-on-surface-variant hover:text-on-surface rounded-md cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                      aria-label="Close picker"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1 mb-2">
                    {folders.length === 0 && !showNewAlbumInput && (
                      <p className="text-[11px] text-on-surface-variant py-3 text-center">No collections yet</p>
                    )}
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => handleAddToFolder(folder.id)}
                        disabled={isProcessing}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-neo text-xs font-medium text-on-surface hover:bg-surface-container transition-all text-left cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                      >
                        <span className="truncate">{folder.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface-container text-on-surface-variant font-mono">
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
                      className="flex items-center gap-1.5 pt-2 border-t border-surface-container-highest"
                    >
                      <input
                        type="text"
                        value={newAlbumName}
                        onChange={(e) => setNewAlbumName(e.target.value)}
                        placeholder="Collection name..."
                        autoFocus
                        className="flex-1 px-2.5 py-1.5 neo-pressed bg-surface-container-lowest rounded-neo text-xs text-on-surface placeholder-on-surface-variant outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      />
                      <button
                        type="submit"
                        disabled={isProcessing || !newAlbumName.trim()}
                        className="p-1.5 neo-button-primary rounded-neo cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
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
                      className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-neo text-xs font-medium text-primary hover:bg-surface-container transition-all cursor-pointer mt-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
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
              className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[42px] sm:min-h-[36px] min-w-[42px] sm:min-w-0 neo-button text-amber-400 hover:bg-amber-500/10 rounded-neo text-xs font-medium transition-all cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
              title="Add Selected to Favorites"
              aria-label="Add selected to Favorites"
            >
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="hidden sm:inline">Favorite</span>
            </button>
          )}

          {/* Download Selected as ZIP */}
          {onDownloadSelected && (
            <button
              onClick={onDownloadSelected}
              disabled={isProcessing}
              className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[42px] sm:min-h-[36px] min-w-[42px] sm:min-w-0 neo-button text-sky-400 hover:bg-sky-500/10 rounded-neo text-xs font-medium transition-all cursor-pointer disabled:opacity-50 touch-manipulation focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none"
              title="Download selected as ZIP archive"
              aria-label="Download selected as ZIP archive"
            >
              <Download className="w-4 h-4 text-sky-400" />
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
                className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[42px] sm:min-h-[36px] min-w-[42px] sm:min-w-0 neo-button text-error hover:bg-error-container/20 rounded-neo text-xs font-medium transition-all cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none"
                title="Move Selected to Trash"
                aria-label="Move selected to Trash"
              >
                <Trash2 className="w-4 h-4 text-error" />
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
                    className="absolute bottom-full right-0 mb-3 w-64 neo-card bg-surface-base border border-error/30 rounded-neo-lg p-4 z-50"
                  >
                    <p className="text-xs text-on-surface-variant mb-3 leading-relaxed">
                      Move <span className="text-on-surface font-bold">{selectedCount}</span> item{selectedCount === 1 ? "" : "s"} to Trash? You can restore them anytime.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 px-3 py-2 min-h-[40px] bg-surface-container hover:bg-surface-container-high text-on-surface rounded-neo text-xs font-medium cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 min-h-[40px] bg-error hover:bg-error/80 disabled:opacity-50 text-white rounded-neo text-xs font-medium cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none"
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
          <div className="h-5 w-px bg-outline-variant/50" />

          {/* Deselect All */}
          <button
            onClick={onDeselectAll}
            className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[42px] sm:min-h-[36px] min-w-[42px] sm:min-w-0 neo-button text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-neo text-xs font-medium transition-all cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            title="Deselect All (Esc)"
            aria-label="Deselect all (Esc)"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Deselect</span>
            <kbd className="hidden md:inline text-[9px] px-1 py-0.2 rounded bg-surface-container text-on-surface-variant font-mono">
              Esc
            </kbd>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

