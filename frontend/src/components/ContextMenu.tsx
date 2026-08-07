/**
 * =============================================================================
 * Module: frontend/src/components/ContextMenu.tsx
 * Purpose: Desktop-grade contextual popup menu for media cards and canvas background,
 *          providing instant actions (open, add to album, delete, download, select, upload).
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: ContextMenu
 * Side Effects: Triggers callbacks for deletion, album assignment, file upload, and selection.
 * =============================================================================
 */

import React, { useEffect, useRef, useState } from "react";
import {
  Maximize2,
  FolderPlus,
  Trash2,
  Download,
  CheckSquare,
  Upload,
  Folder,
  Plus,
  Check,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { FolderItem, MediaItem } from "../types";

export interface ContextMenuPosition {
  x: number;
  y: number;
  targetItem: MediaItem | null;
}

interface ContextMenuProps {
  position: ContextMenuPosition;
  selectedIds: Set<number>;
  folders: FolderItem[];
  onClose: () => void;
  onOpenItem: (item: MediaItem) => void;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onAddToFolder: (folderId: number, mediaIds: number[]) => Promise<void>;
  onCreateFolderAndAdd: (name: string, mediaIds: number[]) => Promise<void>;
  onDeleteMedia: (mediaIds: number[]) => Promise<void>;
  onTriggerUpload: () => void;
  onCreateFolder: (name: string) => Promise<void>;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  position,
  selectedIds,
  folders,
  onClose,
  onOpenItem,
  onToggleSelect,
  onSelectAll,
  onAddToFolder,
  onCreateFolderAndAdd,
  onDeleteMedia,
  onTriggerUpload,
  onCreateFolder,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showAlbumSubmenu, setShowAlbumSubmenu] = useState(false);
  const [showNewAlbumInput, setShowNewAlbumInput] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { targetItem } = position;
  const isTargetSelected = targetItem ? selectedIds.has(targetItem.id) : false;

  // Determine affected media IDs:
  // If targetItem is selected, action applies to all selectedIds.
  // If targetItem is not selected, action applies just to targetItem.
  // If no targetItem (canvas right click), applies to all selectedIds (if any).
  const effectiveMediaIds = targetItem
    ? isTargetSelected && selectedIds.size > 0
      ? Array.from(selectedIds)
      : [targetItem.id]
    : Array.from(selectedIds);

  const count = effectiveMediaIds.length;

  // Close on click outside or escape key or window resize
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleScroll = () => {
      onClose();
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  // Adjust coordinates to prevent overflow out of viewport
  const menuWidth = 220;
  const menuHeight = targetItem ? 260 : 180;
  const screenWidth = typeof window !== "undefined" ? window.innerWidth : 1000;
  const screenHeight = typeof window !== "undefined" ? window.innerHeight : 800;

  const adjustedX = Math.min(position.x, screenWidth - menuWidth - 16);
  const adjustedY = Math.min(position.y, screenHeight - menuHeight - 16);

  const handleAddToExistingFolder = async (folderId: number) => {
    setIsProcessing(true);
    try {
      await onAddToFolder(folderId, effectiveMediaIds);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateAndAssignAlbum = async () => {
    if (!newAlbumName.trim()) return;
    setIsProcessing(true);
    try {
      if (effectiveMediaIds.length > 0) {
        await onCreateFolderAndAdd(newAlbumName.trim(), effectiveMediaIds);
      } else {
        await onCreateFolder(newAlbumName.trim());
      }
      setNewAlbumName("");
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (count === 0) return;
    const confirmMsg =
      count === 1
        ? `Permanently delete this item from your Telegram vault?`
        : `Permanently delete ${count} items from your Telegram vault?`;
    if (!window.confirm(confirmMsg)) return;

    setIsProcessing(true);
    try {
      await onDeleteMedia(effectiveMediaIds);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (targetItem) {
      const a = document.createElement("a");
      a.href = targetItem.stream_url;
      a.download = targetItem.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
      className="fixed z-50 w-56 bg-zinc-900/95 border border-zinc-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-1.5 text-xs text-zinc-200 select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {targetItem ? (
        <>
          {/* Card Specific Actions */}
          <button
            onClick={() => {
              onOpenItem(targetItem);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-sky-500/15 hover:text-sky-400 font-medium transition-all text-left cursor-pointer"
          >
            <Maximize2 className="w-4 h-4 text-zinc-400" />
            <span>Open Preview</span>
          </button>

          <button
            onClick={() => {
              onToggleSelect(targetItem.id);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 hover:text-white font-medium transition-all text-left cursor-pointer"
          >
            <CheckSquare className="w-4 h-4 text-zinc-400" />
            <span>{isTargetSelected ? "Deselect Item" : "Select Item"}</span>
          </button>

          {/* Add to Album submenu toggle */}
          <div
            className="relative"
            onMouseEnter={() => setShowAlbumSubmenu(true)}
            onMouseLeave={() => setShowAlbumSubmenu(false)}
          >
            <button
              onClick={() => setShowAlbumSubmenu((p) => !p)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 hover:text-white font-medium transition-all text-left cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-zinc-400" />
                <span>
                  {count > 1 ? `Add ${count} to Album` : "Add to Album"}
                </span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
            </button>

            {/* Submenu */}
            {showAlbumSubmenu && (
              <div className="absolute top-0 left-full ml-1 w-52 bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="text-[11px] font-bold text-zinc-400 px-2 py-1 border-b border-zinc-800 mb-1">
                  Select Album
                </div>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {folders.length === 0 && !showNewAlbumInput && (
                    <p className="text-[10px] text-zinc-500 py-1.5 text-center">
                      No albums yet
                    </p>
                  )}
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleAddToExistingFolder(folder.id)}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] font-medium text-white/80 hover:bg-sky-500/20 hover:text-sky-300 transition-all text-left cursor-pointer disabled:opacity-50"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Folder className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        <span className="truncate">{folder.name}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 shrink-0">
                        {folder.item_count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Inline New Album Creation inside Submenu */}
                {showNewAlbumInput ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleCreateAndAssignAlbum();
                    }}
                    className="flex items-center gap-1 pt-1.5 mt-1 border-t border-zinc-800"
                  >
                    <input
                      type="text"
                      value={newAlbumName}
                      onChange={(e) => setNewAlbumName(e.target.value)}
                      placeholder="Album name..."
                      autoFocus
                      className="flex-1 px-2 py-1 bg-zinc-950 border border-zinc-800 focus:border-sky-500 rounded text-[11px] text-zinc-100 placeholder-zinc-500 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isProcessing || !newAlbumName.trim()}
                      className="p-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded cursor-pointer"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3" />
                      )}
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowNewAlbumInput(true)}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-sky-400 hover:bg-sky-500/10 transition-all cursor-pointer mt-1 pt-1.5 border-t border-zinc-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Album...</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleDownload}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 hover:text-white font-medium transition-all text-left cursor-pointer"
          >
            <Download className="w-4 h-4 text-zinc-400" />
            <span>Download File</span>
          </button>

          <div className="h-px bg-zinc-800 my-1" />

          {/* Delete Action */}
          <button
            onClick={handleDelete}
            disabled={isProcessing}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-red-500/15 text-red-400 hover:text-red-300 font-medium transition-all text-left cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>{count > 1 ? `Delete ${count} Items` : "Delete"}</span>
          </button>
        </>
      ) : (
        <>
          {/* Canvas Background Actions */}
          <button
            onClick={() => {
              onSelectAll();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 hover:text-white font-medium transition-all text-left cursor-pointer"
          >
            <CheckSquare className="w-4 h-4 text-zinc-400" />
            <span>Select All</span>
          </button>

          <button
            onClick={() => {
              onTriggerUpload();
              onClose();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 hover:text-white font-medium transition-all text-left cursor-pointer"
          >
            <Upload className="w-4 h-4 text-zinc-400" />
            <span>Upload Media</span>
          </button>

          {/* Create Album */}
          {showNewAlbumInput ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateAndAssignAlbum();
              }}
              className="flex items-center gap-1 p-1.5 bg-zinc-950/80 rounded-xl border border-zinc-800 my-1"
            >
              <input
                type="text"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="New album name..."
                autoFocus
                className="flex-1 px-2 py-1 bg-transparent text-[11px] text-zinc-100 placeholder-zinc-500 outline-none"
              />
              <button
                type="submit"
                disabled={isProcessing || !newAlbumName.trim()}
                className="p-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded cursor-pointer"
              >
                {isProcessing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
              </button>
            </form>
          ) : (
            <button
              onClick={() => setShowNewAlbumInput(true)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-zinc-800 hover:text-white font-medium transition-all text-left cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-zinc-400" />
              <span>Create Album</span>
            </button>
          )}
        </>
      )}
    </div>
  );
};
