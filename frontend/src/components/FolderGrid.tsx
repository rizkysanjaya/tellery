/**
 * =============================================================================
 * Module: frontend/src/components/FolderGrid.tsx
 * Purpose: Responsive album and folder grid view with cover thumbnails,
 *          folder creation modal, and deletion controls.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: FolderGrid
 * Side Effects: Triggers folder selection, creation, and deletion events in parent state.
 * =============================================================================
 */

import React, { useState } from "react";
import { Folder, FolderPlus, Trash2, Images, Plus, X, Loader2 } from "lucide-react";
import { FolderItem } from "../types";

interface FolderGridProps {
  folders: FolderItem[];
  onSelectFolder: (folder: FolderItem) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onDeleteFolder: (folderId: number) => Promise<void>;
  loading: boolean;
}

export const FolderGrid: React.FC<FolderGridProps> = ({
  folders,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  loading,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<FolderItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    setIsCreating(true);
    try {
      await onCreateFolder(newFolderName.trim());
      setNewFolderName("");
      setShowCreateModal(false);
    } catch (err) {
      console.error(err);
      alert("Failed to create folder.");
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
      alert("Failed to delete folder.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="pb-16 animate-in fade-in duration-300">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Folder className="w-5 h-5 text-sky-400" />
            Albums & Folders
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Organize your Telegram media warehouse into custom collections
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Album</span>
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading && folders.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-2xl bg-zinc-900 animate-pulse border border-zinc-800"
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && folders.length === 0 && (
        <div className="text-center py-20 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
          <FolderPlus className="w-16 h-16 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-zinc-200">No Albums Created Yet</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            Create your first album to organize family trips, events, or favorite highlights.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Album</span>
          </button>
        </div>
      )}

      {/* Folders Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
        {folders.map((folder) => (
          <div
            key={folder.id}
            onClick={() => onSelectFolder(folder)}
            className="group relative aspect-square rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-sky-500/50 overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl hover:shadow-sky-500/10 transition-all duration-300 hover:-translate-y-1 flex flex-col justify-end"
          >
            {/* Cover Image or Placeholder */}
            {folder.cover_thumbnail_url ? (
              <img
                src={folder.cover_thumbnail_url}
                alt={folder.name}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-tr from-zinc-900 to-zinc-800 flex items-center justify-center">
                <Folder className="w-14 h-14 text-zinc-700 group-hover:text-sky-500 transition-colors" />
              </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent" />

            {/* Delete Button (Hover) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFolderToDelete(folder);
              }}
              className="absolute top-2.5 right-2.5 z-10 p-2 rounded-xl bg-zinc-950/70 hover:bg-red-600 text-zinc-400 hover:text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer shadow-md"
              title="Delete Album"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            {/* Title & Count Info */}
            <div className="relative z-10 p-3.5">
              <h4 className="text-sm font-bold text-white truncate group-hover:text-sky-400 transition-colors">
                {folder.name}
              </h4>
              <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                <Images className="w-3 h-3 text-sky-400" />
                <span>{folder.item_count} {folder.item_count === 1 ? "item" : "items"}</span>
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-sky-400" />
                Create New Album
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Album Name
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Japan 2026, Family, Highlights..."
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 focus:border-sky-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newFolderName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
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
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="max-w-sm w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Delete Album?</h4>
              <p className="text-xs text-zinc-400 mt-1">
                Are you sure you want to delete <span className="text-zinc-200 font-semibold">{folderToDelete.name}</span>?
                Original photos and videos will remain safe in your vault.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setFolderToDelete(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-lg shadow-red-600/20 transition-all cursor-pointer"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeleting ? "Deleting..." : "Delete Album"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
