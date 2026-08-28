/**
 * =============================================================================
 * Module: frontend/src/components/FolderGrid.tsx
 * Purpose: Responsive album and collection grid view with Silk Cloud dark neomorphic design:
 *          - Long-press multi-select system to select multiple albums/collections
 *          - Controlled and stateful collection drill-down sub-album views and breadcrumb navigation
 *          - Interactive Star favorite button on each card (isolated from drag/click)
 *          - Isolated 3-dots action menu for editing, cover thumbnail, moving, deleting
 *          - Floating multi-selection toolbar (bulk favorite, bulk move to collection, bulk delete)
 *          - Live search filtering by album and collection names
 *          - HTML5 drag-and-drop targets with prohibited collection nesting prevention
 *          - Right-click context menu integration and Favorites filter toggle
 * Used by: frontend/src/App.tsx
 * Dependencies: React, framer-motion, lucide-react, frontend/src/types.ts, ui components
 * Public Members: FolderGrid
 * Side Effects: Triggers folder navigation, collection selection, favorite toggling, creation,
 *                deletion dialogs, customize/cover/move modals, and drag-and-drop assignments.
 * =============================================================================
 */

import React, { useState, useMemo, useRef } from "react";
import {
  Folder,
  FolderPlus,
  Images,
  Plus,
  X,
  Loader2,
  ArrowDownToLine,
  Star,
  Layers,
  ChevronRight,
  ChevronLeft,
  Search,
  Check,
  Trash2,
  FolderInput,
  CheckSquare,
  Square,
} from "lucide-react";
import { FolderItem } from "../types";
import { FolderIcon } from "./ui/FolderIcon";
import { FolderActionMenu } from "./ui/FolderActionMenu";
import { FolderCustomizeModal } from "./ui/FolderCustomizeModal";
import { FolderRenameModal } from "./ui/FolderRenameModal";
import { FolderCoverModal } from "./ui/FolderCoverModal";
import { FolderMoveModal } from "./ui/FolderMoveModal";

interface FolderGridProps {
  folders: FolderItem[];
  selectedCollection?: FolderItem | null;
  onSelectCollection?: (collection: FolderItem | null) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
  onSelectFolder: (folder: FolderItem) => void;
  onCreateFolder: (name: string, isCollection?: boolean) => Promise<void>;
  onDeleteFolder: (folder: FolderItem | number) => void | Promise<void>;
  onRenameFolder?: (folderId: number, newName: string) => Promise<void>;
  onCustomizeFolder?: (folderId: number, color: string | null, icon: string) => Promise<void>;
  onSetFolderCover?: (folderId: number, mediaId: number | null) => Promise<void>;
  onToggleFavoriteFolder?: (folderId: number, isFavorite: boolean) => Promise<void>;
  onMoveFolderToCollection?: (folderId: number, collectionId: number | null) => Promise<void>;
  onAddMediaToFolder?: (folderId: number, mediaIds: number[]) => Promise<void>;
  onUpdateFolderColor?: (folderId: number, color: string | null) => Promise<void>;
  onFolderContextMenu?: (e: React.MouseEvent, folder: FolderItem) => void;
  onCanvasContextMenu?: (e: React.MouseEvent) => void;
  loading: boolean;
}

export const FolderGrid: React.FC<FolderGridProps> = ({
  folders,
  selectedCollection: propSelectedCollection,
  onSelectCollection,
  searchQuery = "",
  onClearSearch,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onCustomizeFolder,
  onSetFolderCover,
  onToggleFavoriteFolder,
  onMoveFolderToCollection,
  onAddMediaToFolder,
  onUpdateFolderColor: _onUpdateFolderColor,
  onFolderContextMenu,
  onCanvasContextMenu,
  loading,
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createAsCollection, setCreateAsCollection] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [folderToCustomize, setFolderToCustomize] = useState<FolderItem | null>(null);
  const [folderToRename, setFolderToRename] = useState<FolderItem | null>(null);
  const [folderToCover, setFolderToCover] = useState<FolderItem | null>(null);
  const [folderToMove, setFolderToMove] = useState<FolderItem | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Controlled/Uncontrolled collection drill-down
  const [internalSelectedCollection, setInternalSelectedCollection] = useState<FolderItem | null>(null);
  const selectedCollection = propSelectedCollection !== undefined ? propSelectedCollection : internalSelectedCollection;
  const setSelectedCollection = (col: FolderItem | null) => {
    setInternalSelectedCollection(col);
    onSelectCollection?.(col);
  };

  // Multi-select state for albums & collections
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<number>>(new Set());
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Long-press detection refs
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActiveRef = useRef<boolean>(false);
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Extract all collections for Move submenus
  const collections = useMemo(() => {
    return folders.filter((f) => f.is_collection);
  }, [folders]);

  const query = searchQuery ? searchQuery.trim().toLowerCase() : "";

  // Compute displayed items based on active collection drill-down, favorites, or search query
  const displayedFolders = useMemo(() => {
    let baseList: FolderItem[];
    if (selectedCollection) {
      // Show albums inside the selected collection
      baseList = folders.filter((f) => !f.is_collection && f.parent_id === selectedCollection.id);
    } else if (onlyFavorites) {
      baseList = folders.filter((f) => f.is_favorite);
    } else if (query) {
      // When searching at overview level, search across all collections and albums
      baseList = folders;
    } else {
      // Main view: show collections first, then standalone albums
      baseList = folders.filter((f) => f.is_collection || !f.parent_id);
    }

    if (query) {
      return baseList.filter((f) => f.name.toLowerCase().includes(query));
    }
    return baseList;
  }, [folders, onlyFavorites, selectedCollection, query]);

  const isSelectionMode = selectedFolderIds.size > 0;
  const isAllSelected =
    displayedFolders.length > 0 &&
    displayedFolders.every((f) => selectedFolderIds.has(f.id));

  // Pointer & Long-press handlers
  const handlePointerDown = (folderId: number, e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    isLongPressActiveRef.current = false;
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY };

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      setSelectedFolderIds((prev) => {
        const next = new Set(prev);
        if (next.has(folderId)) {
          next.delete(folderId);
        } else {
          next.add(folderId);
        }
        return next;
      });
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 450);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (pointerStartPosRef.current) {
      const dist = Math.hypot(
        e.clientX - pointerStartPosRef.current.x,
        e.clientY - pointerStartPosRef.current.y
      );
      if (dist > 8 && longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handlePointerUpOrCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartPosRef.current = null;
  };

  const handleCardClick = (folder: FolderItem) => {
    if (isLongPressActiveRef.current) {
      isLongPressActiveRef.current = false;
      return;
    }

    if (isSelectionMode) {
      setSelectedFolderIds((prev) => {
        const next = new Set(prev);
        if (next.has(folder.id)) {
          next.delete(folder.id);
        } else {
          next.add(folder.id);
        }
        return next;
      });
      return;
    }

    if (folder.is_collection) {
      setSelectedCollection(folder);
    } else {
      onSelectFolder(folder);
    }
  };

  const handleToggleSelectFolder = (folderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedFolderIds(new Set());
    } else {
      setSelectedFolderIds(new Set(displayedFolders.map((f) => f.id)));
    }
  };

  const handleBulkToggleFavorites = async (targetFavoriteStatus: boolean) => {
    if (!onToggleFavoriteFolder || isBulkProcessing) return;
    setIsBulkProcessing(true);
    try {
      const ids = Array.from(selectedFolderIds);
      for (const id of ids) {
        await onToggleFavoriteFolder(id, targetFavoriteStatus);
      }
    } catch (err) {
      console.error("Bulk toggle favorite failed:", err);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (isBulkProcessing) return;
    const ids = Array.from(selectedFolderIds);
    if (ids.length === 1) {
      const target = folders.find((f) => f.id === ids[0]);
      if (target) onDeleteFolder(target);
    } else {
      for (const id of ids) {
        const target = folders.find((f) => f.id === id);
        if (target) onDeleteFolder(target);
      }
    }
    setSelectedFolderIds(new Set());
  };

  const handleBulkMoveToCollectionConfirm = async (colId: number | null) => {
    if (!onMoveFolderToCollection) return;
    setIsBulkProcessing(true);
    try {
      const ids = Array.from(selectedFolderIds);
      for (const id of ids) {
        const target = folders.find((f) => f.id === id);
        if (target && !target.is_collection) {
          await onMoveFolderToCollection(id, colId);
        }
      }
      setSelectedFolderIds(new Set());
      setShowBulkMoveModal(false);
    } catch (err) {
      console.error("Bulk move failed:", err);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newFolderName.trim();
    if (!cleanName) return;

    setIsCreating(true);
    try {
      await onCreateFolder(cleanName, createAsCollection);
      setNewFolderName("");
      setShowCreateModal(false);
      setCreateAsCollection(false);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const [prohibitedFolderId, setProhibitedFolderId] = useState<number | null>(null);

  const handleFolderDragOver = (e: React.DragEvent, targetFolder: FolderItem) => {
    if (e.dataTransfer.types.includes("application/telegallery-collection") && targetFolder.is_collection) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "none";
      setProhibitedFolderId(targetFolder.id);
      setDragOverFolderId(null);
      return;
    }

    if (
      e.dataTransfer.types.includes("application/telegallery-album") ||
      e.dataTransfer.types.includes("application/telegallery-media") ||
      e.dataTransfer.types.includes("application/json")
    ) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "copy";
      setProhibitedFolderId(null);
      setDragOverFolderId(targetFolder.id);
    }
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    setProhibitedFolderId(null);
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolder: FolderItem) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    setProhibitedFolderId(null);

    // 1. Check if dragging an Album into a Collection
    const draggedAlbumIdStr = e.dataTransfer.getData("application/telegallery-album");
    if (draggedAlbumIdStr && targetFolder.is_collection) {
      const draggedAlbumId = parseInt(draggedAlbumIdStr, 10);
      if (!isNaN(draggedAlbumId) && onMoveFolderToCollection) {
        await onMoveFolderToCollection(draggedAlbumId, targetFolder.id);
        return;
      }
    }

    // 2. Check if dragging Media Items into an Album/Collection
    const rawData = e.dataTransfer.getData("application/json");
    if (rawData) {
      try {
        const parsed = JSON.parse(rawData);
        if (Array.isArray(parsed) && onAddMediaToFolder) {
          await onAddMediaToFolder(targetFolder.id, parsed);
        } else if (parsed.type === "album" && targetFolder.is_collection && onMoveFolderToCollection) {
          await onMoveFolderToCollection(parsed.id, targetFolder.id);
        }
      } catch (err) {
        console.error("Drop handling error:", err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
        <p className="text-xs text-on-surface-variant">Loading albums & collections...</p>
      </div>
    );
  }

  return (
    <div
      className="pb-24 space-y-6"
      onContextMenu={(e) => {
        if (onCanvasContextMenu && (e.target as HTMLElement).closest(".folder-card-item") === null) {
          onCanvasContextMenu(e);
        }
      }}
    >
      {/* Top Header / Breadcrumbs Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-outline-variant/15">
        <div className="flex items-center gap-3">
          {selectedCollection ? (
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setSelectedCollection(null)}
                className="flex items-center gap-1 font-semibold text-primary hover:text-primary-hover hover:underline cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/40" />
              <div className="flex items-center gap-1.5 font-bold text-on-surface">
                <FolderIcon
                  name={selectedCollection.icon || "Layers"}
                  color={selectedCollection.color || "var(--color-primary, #6366f1)"}
                  className="w-4 h-4"
                />
                <span>{selectedCollection.name}</span>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-headline-lg text-on-surface font-semibold tracking-tight flex items-center gap-2.5">
                <Folder className="w-5 h-5 text-primary" />
                Albums & Collections
              </h2>
              <p className="text-sm text-on-surface-variant mt-0.5">
                Organize your media into albums, collections, and highlights (drag & drop media here)
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Favorites Filter Toggle (only on top-level) */}
          {!selectedCollection && (
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
          )}

          {/* New Album / Collection Actions */}
          {!selectedCollection ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreateAsCollection(true);
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 neo-button rounded-neo text-xs font-semibold text-primary hover:text-primary-hover active:scale-95 transition-all cursor-pointer"
                title="Create a new collection to group albums"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>New Collection</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreateAsCollection(false);
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 neo-button-primary rounded-neo text-xs font-semibold active:scale-95 transition-all cursor-pointer shadow-sm"
                title="Create a new standalone album"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Album</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCreateAsCollection(false);
                setShowCreateModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 neo-button-primary rounded-neo text-xs font-semibold active:scale-95 transition-all cursor-pointer shadow-sm"
              title="Add album to this collection"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Album to Collection</span>
            </button>
          )}
        </div>
      </div>

      {/* Floating Bulk Selection Toolbar */}
      {isSelectionMode && (
        <div className="sticky top-2 z-40 flex items-center justify-between gap-3 px-4 py-3 neo-raised bg-surface-base border border-primary/30 rounded-neo-xl shadow-xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-on-surface hover:text-primary transition-colors cursor-pointer"
            >
              {isAllSelected ? (
                <CheckSquare className="w-4 h-4 text-primary" />
              ) : (
                <Square className="w-4 h-4 text-on-surface-variant" />
              )}
              <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
            </button>
            <div className="h-4 w-px bg-outline-variant/30" />
            <span className="text-xs font-bold text-primary">
              {selectedFolderIds.size} {selectedFolderIds.size === 1 ? "album" : "albums"} selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Bulk Star / Favorite */}
            <button
              type="button"
              onClick={() => handleBulkToggleFavorites(true)}
              disabled={isBulkProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-neo text-xs font-medium neo-button text-amber-400 hover:bg-surface-container active:scale-95 transition-all cursor-pointer"
              title="Add selected to favorites"
            >
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span className="hidden sm:inline">Star All</span>
            </button>

            {/* Bulk Move to Collection */}
            <button
              type="button"
              onClick={() => setShowBulkMoveModal(true)}
              disabled={isBulkProcessing || collections.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-neo text-xs font-medium neo-button text-primary hover:bg-surface-container active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              title="Move selected albums into a collection"
            >
              <FolderInput className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Move to Collection</span>
            </button>

            {/* Bulk Delete */}
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isBulkProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-neo text-xs font-medium neo-button text-error hover:bg-error-container/20 active:scale-95 transition-all cursor-pointer"
              title="Delete selected albums"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>

            {/* Clear / Exit Selection */}
            <button
              type="button"
              onClick={() => setSelectedFolderIds(new Set())}
              className="p-1.5 rounded-neo text-on-surface-variant hover:text-on-surface neo-button cursor-pointer"
              title="Exit selection mode"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {displayedFolders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center px-4 neo-pressed bg-surface-container/20 rounded-neo-xl border border-outline-variant/10">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-4 neo-raised">
            {onlyFavorites ? (
              <Star className="w-8 h-8 text-amber-400/50" />
            ) : query ? (
              <Search className="w-8 h-8 opacity-40" />
            ) : (
              <FolderPlus className="w-8 h-8 text-primary/50" />
            )}
          </div>
          <h3 className="text-base font-bold text-on-surface">
            {onlyFavorites
              ? "No Favorited Albums"
              : query
                ? `No albums found matching "${query}"`
                : selectedCollection
                  ? "This collection is empty"
                  : "No Albums or Collections Yet"}
          </h3>
          <p className="text-xs text-on-surface-variant max-w-sm mt-1.5 leading-relaxed">
            {onlyFavorites
              ? "Star your favorite albums to easily access them in this filter."
              : query
                ? "Try searching for a different name or clear the search query."
                : selectedCollection
                  ? "Drag albums into this collection or click Add Album above."
                  : "Create your first album or collection to organize your photos and videos."}
          </p>
          {query && onClearSearch ? (
            <button
              onClick={onClearSearch}
              className="mt-4 px-4 py-2 neo-button rounded-neo text-xs font-semibold text-primary transition-all cursor-pointer"
            >
              Clear Search
            </button>
          ) : (
            !onlyFavorites && !selectedCollection && (
              <button
                onClick={() => {
                  setCreateAsCollection(false);
                  setShowCreateModal(true);
                }}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2 neo-button-primary rounded-neo text-xs font-semibold active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Album</span>
              </button>
            )
          )}
        </div>
      )}

      {/* Folders & Collections Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
        {displayedFolders.map((folder) => {
          const isDragOver = dragOverFolderId === folder.id;
          const isProhibited = prohibitedFolderId === folder.id;
          const isCollection = folder.is_collection;
          const isSelected = selectedFolderIds.has(folder.id);

          return (
            <div
              key={folder.id}
              className={`aspect-square transition-transform duration-150 ease-out ${
                isSelectionMode ? "" : "hover:-translate-y-1 active:scale-[0.98]"
              }`}
            >
              <div
                draggable={!isSelectionMode}
                onPointerDown={(e) => handlePointerDown(folder.id, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUpOrCancel}
                onPointerCancel={handlePointerUpOrCancel}
                onDragStart={(e) => {
                  if (isSelectionMode) {
                    e.preventDefault();
                    return;
                  }
                  if (isCollection) {
                    e.dataTransfer.setData("application/telegallery-collection", String(folder.id));
                  } else {
                    e.dataTransfer.setData("application/telegallery-album", String(folder.id));
                  }
                  e.dataTransfer.setData(
                    "application/json",
                    JSON.stringify({ type: isCollection ? "collection" : "album", id: folder.id })
                  );
                }}
                onClick={() => handleCardClick(folder)}
                onContextMenu={(e) => {
                  if (onFolderContextMenu) {
                    e.preventDefault();
                    e.stopPropagation();
                    onFolderContextMenu(e, folder);
                  }
                }}
                onDragOver={(e) => handleFolderDragOver(e, folder)}
                onDragLeave={handleFolderDragLeave}
                onDrop={(e) => handleFolderDrop(e, folder)}
                className={`folder-card-item group relative flex flex-col h-full w-full neo-card bg-surface-base rounded-neo-lg cursor-pointer transition-all duration-200 select-none ${
                  isSelected
                    ? "ring-2 ring-primary bg-primary/10 shadow-[0_0_15px_rgba(99,102,241,0.25)] scale-[0.99]"
                    : isProhibited
                      ? "ring-2 ring-red-500 cursor-not-allowed bg-red-950/20"
                      : isDragOver
                        ? "ring-2 ring-primary scale-[1.03]"
                        : "hover:scale-[1.01]"
                } ${isCollection ? "ring-1 ring-primary/30 shadow-[0_4px_20px_rgba(99,102,241,0.15)]" : ""}`}
              >
                <div className="relative flex-1 w-full min-h-[120px] neo-image-wrapper rounded-t-neo-lg bg-surface-container overflow-hidden">
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
                        name={folder.icon || (isCollection ? "Layers" : "Folder")}
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

                  {/* Prohibited Nesting Overlay */}
                  {isProhibited && (
                    <div className="absolute inset-0 bg-red-950/85 backdrop-blur-xs flex flex-col items-center justify-center z-30 p-2 text-center border-2 border-red-500 rounded-t-neo-lg animate-in fade-in duration-150">
                      <span className="text-2xl mb-1">🚫</span>
                      <span className="text-xs font-bold text-red-200 leading-tight">
                        Cannot Nest Collections
                      </span>
                    </div>
                  )}

                  {/* Top-Left Selection Checkbox */}
                  {isSelectionMode ? (
                    <button
                      type="button"
                      draggable={false}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onClick={(e) => handleToggleSelectFolder(folder.id, e)}
                      className={`absolute top-2 left-2 w-6 h-6 rounded-full z-20 flex items-center justify-center transition-all cursor-pointer shadow-md ${
                        isSelected
                          ? "bg-primary text-on-primary ring-2 ring-primary scale-105"
                          : "bg-surface-base/80 backdrop-blur-xs text-transparent hover:text-on-surface-variant border border-outline-variant/40"
                      }`}
                    >
                      <Check className={`w-3.5 h-3.5 ${isSelected ? "text-on-primary" : ""}`} />
                    </button>
                  ) : (
                    <>
                      {/* Collection Pill Badge */}
                      {isCollection ? (
                        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary/90 text-on-primary text-[10px] font-bold tracking-wide shadow-md backdrop-blur-xs flex items-center gap-1 z-10">
                          <Layers className="w-3 h-3" />
                          <span>Collection</span>
                        </div>
                      ) : (
                        /* Interactive Star Button on Album Cards */
                        <button
                          type="button"
                          draggable={false}
                          onPointerDown={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (onToggleFavoriteFolder) {
                              onToggleFavoriteFolder(folder.id, !folder.is_favorite);
                            }
                          }}
                          className={`absolute top-2 left-2 p-1.5 rounded-full z-10 transition-all cursor-pointer ${
                            folder.is_favorite
                              ? "bg-surface-base/90 text-amber-400 shadow-md ring-1 ring-amber-400/40 opacity-100 scale-105"
                              : "bg-surface-base/75 text-on-surface-variant hover:text-amber-400 hover:bg-surface-base/95 shadow-sm opacity-0 group-hover:opacity-100"
                          }`}
                          title={folder.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${folder.is_favorite ? "fill-amber-400 text-amber-400" : ""}`}
                          />
                        </button>
                      )}
                    </>
                  )}

                  {/* Drag Over Active Overlay */}
                  {isDragOver && !isProhibited && (
                    <div className="absolute inset-0 bg-primary/20 backdrop-blur-xs flex flex-col items-center justify-center z-20 animate-in fade-in duration-150">
                      <ArrowDownToLine className="w-8 h-8 text-primary animate-pulse mb-1" />
                      <span className="text-xs font-bold bg-primary text-on-primary px-2.5 py-1 rounded-neo shadow-lg">
                        Drop to Add
                      </span>
                    </div>
                  )}

                  {/* Top-Right 3-Dots Action Menu */}
                  <div
                    className="absolute top-2 right-2 z-10 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    draggable={false}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FolderActionMenu
                      folder={folder}
                      collections={collections}
                      onCustomize={(f) => setFolderToCustomize(f)}
                      onSelectCover={(f) => setFolderToCover(f)}
                      onRename={(f) => setFolderToRename(f)}
                      onOpenMoveModal={(f) => setFolderToMove(f)}
                      onMoveToCollection={
                        onMoveFolderToCollection
                          ? (f, colId) => onMoveFolderToCollection(f.id, colId)
                          : undefined
                      }
                      onToggleFavorite={(f) => {
                        if (onToggleFavoriteFolder) {
                          onToggleFavoriteFolder(f.id, !f.is_favorite);
                        }
                      }}
                      onDelete={(f) => onDeleteFolder(f)}
                      triggerClassName="bg-surface-base/85 backdrop-blur-xs shadow-md hover:bg-surface-container"
                    />
                  </div>
                </div>

                {/* Folder Details */}
                <div className="p-3 sm:p-4 border-t border-outline-variant/10">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FolderIcon
                      name={folder.icon || (isCollection ? "Layers" : "Folder")}
                      color={folder.color || "var(--color-primary, #6366f1)"}
                      className="w-4 h-4 shrink-0 transition-colors"
                    />
                    <h3 className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                      {folder.name}
                    </h3>
                  </div>

                  {/* Item / Sub-album count aligned cleanly underneath the title */}
                  <div className="flex items-center gap-1.5 mt-1.5 pl-6.5">
                    {isCollection ? (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md neo-pressed bg-surface-container text-xs font-medium text-primary">
                        <Layers className="w-3 h-3 text-primary" />
                        <span className="font-semibold">{folder.sub_album_count ?? 0}</span>
                        <span className="text-on-surface-variant text-[11px]">
                          {(folder.sub_album_count ?? 0) === 1 ? "album" : "albums"}
                        </span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md neo-pressed bg-surface-container text-xs font-medium text-on-surface">
                        <Images className="w-3 h-3 text-primary" />
                        <span className="font-semibold">{folder.item_count}</span>
                        <span className="text-on-surface-variant text-[11px]">
                          {folder.item_count === 1 ? "item" : "items"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Folder / Collection Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-surface-base border border-outline-variant/15 rounded-neo-xl p-6 neo-card shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                {createAsCollection ? (
                  <Layers className="w-5 h-5 text-primary" />
                ) : (
                  <FolderPlus className="w-5 h-5 text-primary" />
                )}
                <span>{createAsCollection ? "Create New Collection" : "Create New Album"}</span>
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateAsCollection(false);
                }}
                className="p-1 rounded-neo text-on-surface-variant hover:text-on-surface neo-button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  {createAsCollection ? "Collection Name" : "Album Name"}
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={createAsCollection ? "e.g., Vacation 2026, Work..." : "e.g., Summer Trip, Portraits..."}
                  autoFocus
                  required
                  className="w-full px-3.5 py-2.5 rounded-neo-lg neo-pressed bg-surface-container/50 border border-outline-variant/20 text-on-surface text-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateAsCollection(false);
                  }}
                  className="px-4 py-2 neo-button rounded-neo text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newFolderName.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 neo-button-primary rounded-neo text-xs font-semibold disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{createAsCollection ? "Create Collection" : "Create Album"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Move Modal */}
      {showBulkMoveModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-surface-base border border-outline-variant/15 rounded-neo-xl p-6 neo-card shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <FolderInput className="w-5 h-5 text-primary" />
                <span>Move {selectedFolderIds.size} Albums to Collection</span>
              </h3>
              <button
                onClick={() => setShowBulkMoveModal(false)}
                className="p-1 rounded-neo text-on-surface-variant hover:text-on-surface neo-button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1 py-1">
              <button
                type="button"
                onClick={() => handleBulkMoveToCollectionConfirm(null)}
                className="w-full flex items-center justify-between p-3 rounded-neo-lg hover:bg-surface-container text-left transition-colors cursor-pointer"
              >
                <span className="text-xs font-semibold text-on-surface">Ungroup (Standalone Albums)</span>
              </button>
              {collections.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => handleBulkMoveToCollectionConfirm(col.id)}
                  className="w-full flex items-center gap-2.5 p-3 rounded-neo-lg hover:bg-surface-container text-left transition-colors cursor-pointer"
                >
                  <FolderIcon name={col.icon || "Layers"} color={col.color || "var(--color-primary)"} className="w-4 h-4" />
                  <span className="text-xs font-semibold text-on-surface">{col.name}</span>
                </button>
              ))}
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
          onSave={onCustomizeFolder || (async () => {})}
        />
      )}

      {/* Rename Folder Modal */}
      {folderToRename && (
        <FolderRenameModal
          folder={folderToRename}
          isOpen={Boolean(folderToRename)}
          onClose={() => setFolderToRename(null)}
          onRename={onRenameFolder || (async () => {})}
        />
      )}

      {/* Folder Cover Modal */}
      {folderToCover && (
        <FolderCoverModal
          folder={folderToCover}
          isOpen={Boolean(folderToCover)}
          onClose={() => setFolderToCover(null)}
          onSaveCover={onSetFolderCover || (async () => {})}
        />
      )}

      {/* Move Folder Modal */}
      {folderToMove && (
        <FolderMoveModal
          folder={folderToMove}
          collections={collections}
          isOpen={Boolean(folderToMove)}
          onClose={() => setFolderToMove(null)}
          onMove={onMoveFolderToCollection || (async () => {})}
        />
      )}
    </div>
  );
};
