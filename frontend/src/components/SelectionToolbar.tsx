/**
 * =============================================================================
 * Module: frontend/src/components/SelectionToolbar.tsx
 * Purpose: 21st.dev Floating Dynamic Island action dock shown when 1+ media items
 *          are selected. Provides bulk operations: Add to Album, Delete, Deselect.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: SelectionToolbar
 * Side Effects: Triggers bulk album assignment, deletion, and deselection callbacks.
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
} from "lucide-react";
import { FolderItem } from "../types";

interface SelectionToolbarProps {
  selectedCount: number;
  folders: FolderItem[];
  onAddToFolder: (folderId: number) => Promise<void>;
  onCreateFolderAndAdd: (name: string) => Promise<void>;
  onDeleteSelected: () => Promise<void>;
  onDeselectAll: () => void;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({
  selectedCount,
  folders,
  onAddToFolder,
  onCreateFolderAndAdd,
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
          className="selection-toolbar fixed bottom-7 left-1/2 -translate-x-1/2 z-40 bg-zinc-950/90 border border-white/[0.12] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl px-2.5 py-2 flex items-center gap-2 ring-1 ring-white/5 select-none"
        >
          {/* Selected Count */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-500/15 border border-sky-500/30 rounded-xl shadow-[0_0_15px_rgba(14,165,233,0.2)]">
            <div className="w-4 h-4 rounded-md bg-sky-500 flex items-center justify-center">
              <Check className="w-3 h-3 text-white" strokeWidth={3} />
            </div>
            <span className="text-xs font-bold text-sky-300 font-mono whitespace-nowrap">
              {selectedCount} selected
            </span>
          </div>

          {/* Separator */}
          <div className="h-5 w-px bg-white/[0.1]" />

          {/* Add to Album */}
          <div className="relative">
            <button
              onClick={() => {
                setShowFolderPicker((p) => !p);
                setShowDeleteConfirm(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-zinc-300 hover:text-white hover:bg-zinc-800/80 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              title="Add to Album"
            >
              <FolderPlus className="w-4 h-4 text-sky-400" />
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
                  className="absolute bottom-full left-0 mb-3 w-64 bg-zinc-900/95 border border-white/[0.1] rounded-2xl p-3 shadow-2xl backdrop-blur-2xl z-50"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.08]">
                    <span className="text-xs font-bold text-white">Choose Collection</span>
                    <button
                      onClick={() => setShowFolderPicker(false)}
                      className="p-1 text-zinc-400 hover:text-white rounded-md cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="max-h-44 overflow-y-auto space-y-1 mb-2">
                    {folders.length === 0 && !showNewAlbumInput && (
                      <p className="text-[11px] text-zinc-500 py-3 text-center">No collections yet</p>
                    )}
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => handleAddToFolder(folder.id)}
                        disabled={isProcessing}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-all text-left cursor-pointer disabled:opacity-50"
                      >
                        <span className="truncate">{folder.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-700/60 text-zinc-400 font-mono">
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
                      className="flex items-center gap-1.5 pt-2 border-t border-white/[0.08]"
                    >
                      <input
                        type="text"
                        value={newAlbumName}
                        onChange={(e) => setNewAlbumName(e.target.value)}
                        placeholder="Collection name..."
                        autoFocus
                        className="flex-1 px-2.5 py-1.5 bg-zinc-950/80 border border-white/[0.1] focus:border-sky-500 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 outline-none"
                      />
                      <button
                        type="submit"
                        disabled={isProcessing || !newAlbumName.trim()}
                        className="p-1.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg cursor-pointer"
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
                      className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-sky-400 hover:bg-sky-500/10 border border-dashed border-sky-500/30 transition-all cursor-pointer mt-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create New Collection</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Delete Selected */}
          <div className="relative">
            <button
              onClick={() => {
                setShowDeleteConfirm((p) => !p);
                setShowFolderPicker(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/15 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              title="Delete Selected"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
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
                  className="absolute bottom-full right-0 mb-3 w-64 bg-zinc-900/95 border border-red-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-2xl z-50"
                >
                  <p className="text-xs text-zinc-300 mb-3 leading-relaxed">
                    Permanently delete <span className="text-white font-bold">{selectedCount}</span> items
                    from your vault? This cannot be undone.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={isProcessing}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-[0_0_15px_rgba(239,68,68,0.4)] cursor-pointer"
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

          {/* Separator */}
          <div className="h-5 w-px bg-white/[0.1]" />

          {/* Deselect All */}
          <button
            onClick={onDeselectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            title="Deselect All (Esc)"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Deselect</span>
            <kbd className="hidden md:inline text-[9px] px-1 py-0.2 rounded bg-zinc-800 border border-zinc-700 text-zinc-500 font-mono">
              Esc
            </kbd>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

