/**
 * =============================================================================
 * Module: frontend/src/components/FolderGrid.tsx
 * Purpose: Responsive album and folder grid view with cover thumbnails,
 *          folder creation modal, deletion controls, HTML5 drag-and-drop target support,
 *          3-dots action menu (customize icon & color, rename, favorite, delete),
 *          and Favorites filter toggle.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts, FolderIcon, FolderActionMenu, FolderCustomizeModal, FolderRenameModal
 * Public Members: FolderGrid
 * Side Effects: Triggers folder selection, creation, deletion, folder color/icon updates,
 *                favorite toggling, renaming, and media drop assignments in parent state.
 * =============================================================================
 */

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Folder,
  FolderPlus,
  Trash2,
  Images,
  Plus,
  X,
  Loader2,
  ArrowDownToLine,
  Star,
} from "lucide-react";
import { FolderItem } from "../types";
import { FolderIcon } from "./ui/FolderIcon";
import { FolderActionMenu } from "./ui/FolderActionMenu";
import { FolderCustomizeModal } from "./ui/FolderCustomizeModal";
import { FolderRenameModal } from "./ui/FolderRenameModal";

interface FolderGridProps {
  folders: FolderItem[];
  onSelectFolder: (folder: FolderItem) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onDeleteFolder: (folderId: number) => Promise<void>;
  onRenameFolder?: (folderId: number, newName: string) => Promise<void>;
  onCustomizeFolder?: (folderId: number, color: string | null, icon: string) => Promise<void>;
  onToggleFavoriteFolder?: (folderId: number, isFavorite: boolean) => Promise<void>;
  onAddMediaToFolder?: (folderId: number, mediaIds: number[]) => Promise<void>;
  onUpdateFolderColor?: (folderId: number, color: string | null) => Promise<void>;
  loading: boolean;
}

export const FolderGrid: React.FC<FolderGridProps> = ({
  folders,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onCustomizeFolder,
  onToggleFavoriteFolder,
  onAddMediaToFolder,
  loading,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
  const [folderToCustomize, setFolderToCustomize] = useState<FolderItem | null>(null);
  const [folderToRename, setFolderToRename] = useState<FolderItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const displayedFolders = useMemo(() => {
    if (!onlyFavorites) return folders;
    return folders.filter((f) => f.is_favorite);
  }, [folders, onlyFavorites]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newFolderName.trim();
    if (!cleanName) return;

    setIsCreating(true);
    try {
      await onCreateFolder(cleanName);
      setNewFolderName("");
      setShowCreateModal(false);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!folderToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteFolder(folderToDelete.id);
      setFolderToDelete(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFolderDragOver = (e: React.DragEvent, folderId: number) => {
    if (
      e.dataTransfer.types.includes("application/telegallery-media") ||
      e.dataTransfer.types.includes("application/json")
    ) {
      e.preventDefault();
      e.stopPropagation();
      setDragOverFolderId(folderId);
    }
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
  };

  const handleFolderDrop = async (e: React.DragEvent, folderId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);

    let rawData = e.dataTransfer.getData("application/telegallery-media");
    if (!rawData) {
      rawData = e.dataTransfer.getData("application/json");
    }

    if (!rawData || !onAddMediaToFolder) return;

    try {
      const mediaIds: number[] = JSON.parse(rawData);
      if (Array.isArray(mediaIds) && mediaIds.length > 0) {
        await onAddMediaToFolder(folderId, mediaIds);
      }
    } catch (err) {
      console.error("Failed to parse dragged media payload", err);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 pb-20 select-none"
    >
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-outline-variant/20">
        <div>
          <h2 className="text-headline-lg text-on-surface font-semibold tracking-tight flex items-center gap-2.5">
            <Folder className="w-5 h-5 text-primary" />
            Albums
          </h2>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Organize your media into albums, collections, and highlights (drag & drop media here)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Favorites Filter Toggle */}
          <button
            type="button"
            onClick={() => setOnlyFavorites((p) => !p)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-neo text-xs font-semibold transition-all cursor-pointer ${
              onlyFavorites
                ? "neo-pressed bg-surface-base text-amber-400 ring-1 ring-amber-400/40"
                : "neo-button text-on-surface-variant hover:text-amber-400"
            }`}
            title="Filter by favorited albums"
          >
            <Star className={`w-3.5 h-3.5 ${onlyFavorites ? "fill-amber-400" : ""}`} />
            <span>Favorites</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 neo-button-primary rounded-neo px-4 py-2 text-sm font-medium transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Album</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && folders.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-2xl bg-zinc-900/60 animate-pulse border border-white/[0.06]"
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && displayedFolders.length === 0 && (
        <div className="text-center py-20 bg-zinc-900/30 rounded-3xl border border-dashed border-white/[0.08]">
          <FolderPlus className="w-16 h-16 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-zinc-200">
            {onlyFavorites ? "No Favorite Albums Found" : "No Collections Created Yet"}
          </h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            {onlyFavorites
              ? "Star your favorite albums using the 3-dots menu to find them quickly here."
              : "Create your first collection to organize trips, events, or favorite highlights."}
          </p>
          {!onlyFavorites && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-semibold shadow-[0_0_20px_rgba(14,165,233,0.3)] active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Collection</span>
            </button>
          )}
        </div>
      )}

      {/* Folders Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
        {displayedFolders.map((folder) => {
          const isDragOver = dragOverFolderId === folder.id;

          return (
            <div
              key={folder.id}
              className="aspect-square transition-transform duration-150 ease-out hover:-translate-y-1 active:scale-[0.98]"
            >
              <div
                onClick={() => onSelectFolder(folder)}
                onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                onDragLeave={handleFolderDragLeave}
                onDrop={(e) => handleFolderDrop(e, folder.id)}
                className={`folder-card-item group flex flex-col h-full w-full neo-card bg-surface-base rounded-neo-lg overflow-hidden cursor-pointer transition-all duration-200 ${
                  isDragOver ? "ring-2 ring-primary scale-[1.03]" : "hover:scale-[1.01]"
                }`}
              >
                <div className="relative flex-1 w-full min-h-[120px] neo-image-wrapper overflow-hidden bg-surface-container">
                  {/* Cover Image or Placeholder */}
                  {folder.cover_thumbnail_url ? (
                    <img
                      src={folder.cover_thumbnail_url}
                      alt={folder.name}
                      className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 ${
                        isDragOver ? "scale-110" : "group-hover:scale-105"
                      }`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface-container">
                      <FolderIcon
                        name={folder.icon || "Folder"}
                        color={folder.color || (isDragOver ? "var(--color-primary, #6366f1)" : undefined)}
                        className={`w-12 h-12 transition-colors ${
                          folder.color
                            ? ""
                            : isDragOver
                              ? "text-primary scale-110"
                              : "text-on-surface-variant group-hover:text-primary"
                        }`}
                      />
                    </div>
                  )}

                  {/* Favorite Badge (top-left) */}
                  {folder.is_favorite && (
                    <div className="absolute top-2 left-2 p-1.5 rounded-full bg-surface-base/80 shadow-md backdrop-blur-xs text-amber-400 z-10">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                    </div>
                  )}

                  {/* Drag Over Active Overlay */}
                  {isDragOver && (
                    <div className="absolute inset-0 bg-primary/20 backdrop-blur-xs flex flex-col items-center justify-center z-20 animate-in fade-in duration-150">
                      <ArrowDownToLine className="w-8 h-8 text-primary animate-pulse mb-1" />
                      <span className="text-xs font-bold bg-primary text-on-primary px-2.5 py-1 rounded-neo shadow-lg">
                        Drop to Add
                      </span>
                    </div>
                  )}

                  {/* Top-Right 3-Dots Action Menu */}
                  <div
                    className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FolderActionMenu
                      folder={folder}
                      onCustomize={(f) => setFolderToCustomize(f)}
                      onRename={(f) => setFolderToRename(f)}
                      onToggleFavorite={(f) => {
                        if (onToggleFavoriteFolder) {
                          onToggleFavoriteFolder(f.id, !f.is_favorite);
                        }
                      }}
                      onDelete={(f) => setFolderToDelete(f)}
                      triggerClassName="bg-surface-base/85 backdrop-blur-xs shadow-md"
                    />
                  </div>
                </div>

                {/* Folder Details */}
                <div className="p-3 sm:p-4 border-t border-outline-variant/10">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderIcon
                        name={folder.icon || "Folder"}
                        color={folder.color || "var(--color-primary, #6366f1)"}
                        className="w-4 h-4 shrink-0 transition-colors"
                      />
                      <h3 className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                        {folder.name}
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant mt-1 font-mono pl-6">
                    <Images className="w-3 h-3 text-primary" />
                    <span>{folder.item_count} items</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-surface-base border border-outline-variant/15 rounded-neo-xl p-6 neo-card shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-primary" />
                Create New Album
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-neo text-on-surface-variant hover:text-on-surface neo-button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
                  Album Name
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Japan 2026, Family, Highlights..."
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 bg-surface-container-lowest neo-pressed rounded-neo-lg text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none transition-all focus:ring-1 focus:ring-primary/40"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 neo-button rounded-neo-lg text-on-surface text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newFolderName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 neo-button-primary rounded-neo-lg disabled:opacity-50 text-xs font-semibold shadow-lg transition-all cursor-pointer"
                >
                  {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isCreating ? "Creating..." : "Create Album"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Folder Modal */}
      {folderToDelete && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="max-w-sm w-full bg-surface-base rounded-neo-xl p-6 neo-card text-center space-y-4 border border-outline-variant/15 shadow-2xl">
            <div className="w-12 h-12 rounded-neo-lg bg-red-500/10 text-red-400 flex items-center justify-center mx-auto shadow-[inset_4px_4px_8px_rgba(0,0,0,0.2)]">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-on-surface">Delete Album?</h4>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                Delete album <span className="text-on-surface font-semibold">"{folderToDelete.name}"</span>?
                Original photos and videos will remain safe in your vault.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setFolderToDelete(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 neo-button rounded-neo-lg text-on-surface text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-600/20 text-red-400 hover:bg-red-600/30 active:scale-95 disabled:opacity-50 rounded-neo-lg text-xs font-semibold transition-all cursor-pointer"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? "Deleting..." : "Delete Album"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customize Folder Modal */}
      {folderToCustomize && (
        <FolderCustomizeModal
          folder={folderToCustomize}
          isOpen={Boolean(folderToCustomize)}
          onClose={() => setFolderToCustomize(null)}
          onSave={async (folderId, color, icon) => {
            if (onCustomizeFolder) {
              await onCustomizeFolder(folderId, color, icon);
            }
          }}
        />
      )}

      {/* Rename Folder Modal */}
      {folderToRename && (
        <FolderRenameModal
          folder={folderToRename}
          isOpen={Boolean(folderToRename)}
          onClose={() => setFolderToRename(null)}
          onRename={async (folderId, newName) => {
            if (onRenameFolder) {
              await onRenameFolder(folderId, newName);
            }
          }}
        />
      )}
    </motion.div>
  );
};
