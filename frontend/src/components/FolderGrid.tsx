/**
 * =============================================================================
 * Module: frontend/src/components/FolderGrid.tsx
 * Purpose: Responsive album and collection grid view with pro-grade obsidian craft:
 *          - Multi-select system to select multiple albums/collections
 *          - Collection drill-down sub-album views and breadcrumb navigation
 *          - Interactive Star favorite button on each card (isolated from drag/click)
 *          - Isolated 3-dots action menu for editing, cover thumbnail, moving, ZIP export, deleting
 *          - Floating precision multi-selection toolbar (bulk favorite, bulk move, bulk delete)
 *          - Live search filtering by album and collection names
 *          - HTML5 drag-and-drop targets with prohibited collection nesting prevention
 *          - Right-click context menu integration and Favorites filter toggle
 * Used by: frontend/src/App.tsx
 * Dependencies: React, framer-motion, lucide-react, frontend/src/types.ts, ui components
 * Public Members: FolderGrid
 * Side Effects: Triggers folder navigation, collection selection, favorite toggling, creation,
 *                deletion dialogs, customize/cover/move modals, ZIP exports, and drag-and-drop assignments.
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
  onDeleteFolder: (folder: FolderItem | FolderItem[] | number | number[]) => void | Promise<void>;
  onRenameFolder?: (folderId: number, newName: string) => Promise<void>;
  onCustomizeFolder?: (folderId: number, color: string | null, icon: string) => Promise<void>;
  onSetFolderCover?: (folderId: number, mediaId: number | null) => Promise<void>;
  onToggleFavoriteFolder?: (folderId: number, isFavorite: boolean) => Promise<void>;
  onMoveFolderToCollection?: (folderId: number, collectionId: number | null) => Promise<void>;
  onAddMediaToFolder?: (folderId: number, mediaIds: number[]) => Promise<void>;
  onUpdateFolderColor?: (folderId: number, color: string | null) => Promise<void>;
  onExportFolderZip?: (folder: FolderItem) => void;
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
  onExportFolderZip,
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
  const [draggedSourceFolderIds, setDraggedSourceFolderIds] = useState<Set<number>>(new Set());
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

  const handleBulkDelete = () => {
    if (isBulkProcessing) return;
    const selected = folders.filter((f) => selectedFolderIds.has(f.id));
    if (selected.length === 0) return;
    onDeleteFolder(selected);
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
    e.preventDefault();
    e.stopPropagation();

    // 1. Never allow dropping an album or collection into itself or into any selected item
    if (draggedSourceFolderIds.has(targetFolder.id)) {
      e.dataTransfer.dropEffect = "none";
      setDragOverFolderId(null);
      return;
    }

    const isDraggingAlbum =
      e.dataTransfer.types.includes("application/telegallery-album") ||
      e.dataTransfer.types.includes("application/telegallery-albums") ||
      draggedSourceFolderIds.size > 0;
    const isDraggingCollection = e.dataTransfer.types.includes("application/telegallery-collection");

    // 2. Albums can only be dropped into a collection (not into another standalone album)
    if (isDraggingAlbum && !targetFolder.is_collection) {
      e.dataTransfer.dropEffect = "none";
      setDragOverFolderId(null);
      return;
    }

    // 3. Prevent dropping a collection into another collection (no nested collections)
    if (isDraggingCollection && targetFolder.is_collection) {
      e.dataTransfer.dropEffect = "none";
      setProhibitedFolderId(targetFolder.id);
      setDragOverFolderId(null);
      return;
    }

    // 4. Valid drop target: Album into Collection, or Media into Album/Collection
    e.dataTransfer.dropEffect = "copy";
    setProhibitedFolderId(null);
    if (dragOverFolderId !== targetFolder.id) {
      setDragOverFolderId(targetFolder.id);
    }
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const currentTarget = e.currentTarget as HTMLElement;
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!currentTarget || !relatedTarget || !currentTarget.contains(relatedTarget)) {
      setDragOverFolderId(null);
      setProhibitedFolderId(null);
    }
  };

  const handleFolderDrop = async (e: React.DragEvent, targetFolder: FolderItem) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolderId(null);
    setProhibitedFolderId(null);

    const multiAlbumStr = e.dataTransfer.getData("application/telegallery-albums");
    const singleAlbumStr = e.dataTransfer.getData("application/telegallery-album");
    const jsonData = e.dataTransfer.getData("application/json");
    const plainText = e.dataTransfer.getData("text/plain");

    let albumIdsToMove: number[] = [];

    if (multiAlbumStr) {
      try {
        const parsed = JSON.parse(multiAlbumStr);
        if (Array.isArray(parsed)) albumIdsToMove = parsed;
      } catch {}
    }

    if (jsonData) {
      try {
        const parsed = JSON.parse(jsonData);
        if (Array.isArray(parsed) && onAddMediaToFolder) {
          // Dropped array of media items
          await onAddMediaToFolder(targetFolder.id, parsed);
          return;
        } else if (parsed && parsed.ids && Array.isArray(parsed.ids)) {
          albumIdsToMove = parsed.ids;
        } else if (parsed && parsed.type === "album" && parsed.id) {
          albumIdsToMove = [parsed.id];
        }
      } catch (err) {
        console.error("Error parsing folder drop payload:", err);
      }
    }

    if (albumIdsToMove.length === 0 && singleAlbumStr) {
      const parsed = parseInt(singleAlbumStr, 10);
      if (!isNaN(parsed)) albumIdsToMove = [parsed];
    }

    if (albumIdsToMove.length === 0 && plainText && plainText.startsWith("album:")) {
      const parts = plainText.split(",").map((s) => parseInt(s.replace("album:", "").trim(), 10)).filter((n) => !isNaN(n));
      if (parts.length > 0) albumIdsToMove = parts;
    }

    // Move albums into target collection
    if (albumIdsToMove.length > 0 && targetFolder.is_collection && onMoveFolderToCollection) {
      for (const aId of albumIdsToMove) {
        if (aId !== targetFolder.id) {
          const source = folders.find((f) => f.id === aId);
          if (source && !source.is_collection) {
            await onMoveFolderToCollection(aId, targetFolder.id);
          }
        }
      }
      setSelectedFolderIds(new Set());
      setDraggedSourceFolderIds(new Set());
      return;
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

        <div className="flex items-center gap-2">
          {/* Favorites Filter Toggle (only on top-level) */}
          {!selectedCollection && (
            <button
              type="button"
              onClick={() => setOnlyFavorites((p) => !p)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                onlyFavorites
                  ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                  : "border-outline-variant/15 text-on-surface-variant hover:text-amber-400 hover:bg-white/[0.04]"
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/15 text-xs font-semibold text-primary hover:bg-white/[0.04] active:scale-95 transition-all cursor-pointer"
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
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all cursor-pointer shadow-sm"
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all cursor-pointer shadow-sm"
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
        <div className="sticky top-2 z-40 flex items-center justify-between gap-3 px-4 py-2.5 bg-surface-container-low/95 backdrop-blur-md border border-outline-variant/25 rounded-xl shadow-2xl animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSelectAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-on-surface hover:text-primary transition-colors cursor-pointer"
            >
              {isAllSelected ? (
                <CheckSquare className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Square className="w-3.5 h-3.5 text-on-surface-variant" />
              )}
              <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
            </button>
            <div className="h-4 w-px bg-outline-variant/20" />
            <span className="text-xs font-semibold text-primary">
              {selectedFolderIds.size} {selectedFolderIds.size === 1 ? "album" : "albums"} selected
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Bulk Star / Favorite */}
            <button
              type="button"
              onClick={() => handleBulkToggleFavorites(true)}
              disabled={isBulkProcessing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-outline-variant/15 text-amber-400 hover:bg-white/[0.04] transition-colors cursor-pointer"
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
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-outline-variant/15 text-primary hover:bg-white/[0.04] transition-colors cursor-pointer disabled:opacity-50"
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
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-500/15 border border-rose-500/30 text-rose-400 hover:bg-rose-500/25 transition-colors cursor-pointer"
              title="Delete selected albums"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Delete</span>
            </button>

            {/* Clear / Exit Selection */}
            <button
              type="button"
              onClick={() => setSelectedFolderIds(new Set())}
              className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] transition-colors cursor-pointer"
              title="Exit selection mode"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {displayedFolders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center px-4 bg-surface-container-low/30 rounded-2xl border border-dashed border-outline-variant/15">
          <div className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant mb-3 border border-outline-variant/15">
            {onlyFavorites ? (
              <Star className="w-7 h-7 text-amber-400/60" />
            ) : query ? (
              <Search className="w-7 h-7 opacity-40" />
            ) : (
              <FolderPlus className="w-7 h-7 text-primary/60" />
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
          <p className="text-xs text-on-surface-variant max-w-sm mt-1 leading-relaxed">
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
              className="mt-4 px-3.5 py-1.5 rounded-lg border border-outline-variant/15 text-xs font-semibold text-primary hover:bg-white/[0.04] transition-colors cursor-pointer"
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
                className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all cursor-pointer shadow-sm"
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
                draggable={true}
                onPointerDown={(e) => handlePointerDown(folder.id, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUpOrCancel}
                onPointerCancel={handlePointerUpOrCancel}
                onDragStart={(e) => {
                  const effectiveIds =
                    selectedFolderIds.has(folder.id) && selectedFolderIds.size > 0
                      ? Array.from(selectedFolderIds)
                      : [folder.id];

                  setDraggedSourceFolderIds(new Set(effectiveIds));
                  e.dataTransfer.effectAllowed = "copyMove";

                  if (isCollection) {
                    e.dataTransfer.setData("application/telegallery-collection", String(folder.id));
                    e.dataTransfer.setData("text/plain", `collection:${folder.id}`);
                  } else {
                    e.dataTransfer.setData("application/telegallery-albums", JSON.stringify(effectiveIds));
                    e.dataTransfer.setData("application/telegallery-album", String(folder.id));
                    e.dataTransfer.setData(
                      "text/plain",
                      effectiveIds.map((id) => `album:${id}`).join(",")
                    );
                  }

                  e.dataTransfer.setData(
                    "application/json",
                    JSON.stringify({
                      type: isCollection ? "collection" : "album",
                      id: folder.id,
                      ids: effectiveIds,
                    })
                  );
                }}
                onDragEnd={() => {
                  setDraggedSourceFolderIds(new Set());
                  setDragOverFolderId(null);
                  setProhibitedFolderId(null);
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
                className={`folder-card-item group relative flex flex-col h-full w-full bg-surface-container-low/60 hover:bg-surface-container-low border rounded-xl cursor-pointer transition-all duration-150 select-none ${
                  isSelected
                    ? "ring-2 ring-primary border-transparent bg-surface-container-low"
                    : isProhibited
                      ? "ring-2 ring-rose-500 cursor-not-allowed bg-rose-950/20 border-rose-500/40"
                      : isDragOver
                        ? "ring-2 ring-primary border-transparent"
                        : "border-outline-variant/15 hover:border-outline-variant/30"
                } ${isCollection ? "ring-1 ring-primary/30" : ""}`}
              >
                <div className="relative flex-1 w-full min-h-[120px] rounded-t-xl bg-surface-container overflow-hidden">
                  {/* Cover Image or Placeholder */}
                  {folder.cover_thumbnail_url ? (
                    <img
                      src={folder.cover_thumbnail_url}
                      alt={folder.name}
                      draggable={false}
                      className={`absolute inset-0 w-full h-full object-cover transition-transform duration-300 pointer-events-none select-none ${
                        isDragOver ? "scale-110" : "group-hover:scale-105"
                      }`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface-container">
                      <FolderIcon
                        name={folder.icon || (isCollection ? "Layers" : "Folder")}
                        color={folder.color || (isDragOver ? "var(--color-primary, #6366f1)" : undefined)}
                        className={`w-10 h-10 transition-colors ${
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
                    <div className="absolute inset-0 bg-red-950/85 backdrop-blur-xs flex flex-col items-center justify-center z-30 p-2 text-center border-2 border-red-500 rounded-t-xl animate-in fade-in duration-150">
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
                          : "bg-black/60 backdrop-blur-md text-transparent hover:text-white border border-white/20"
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
                              ? "bg-black/60 text-amber-400 shadow-md ring-1 ring-amber-400/40 opacity-100 scale-105"
                              : "bg-black/50 text-white/80 hover:text-amber-400 hover:bg-black/70 shadow-sm opacity-0 group-hover:opacity-100"
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
                      <span className="text-xs font-semibold bg-primary text-on-primary px-2.5 py-1 rounded-md shadow-lg">
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
                      onExportZip={onExportFolderZip}
                      onDelete={(f) => onDeleteFolder(f)}
                      triggerClassName="bg-black/60 border border-white/15 text-white backdrop-blur-md shadow-md hover:bg-black/80"
                    />
                  </div>
                </div>

                {/* Folder Details */}
                <div className="p-3 border-t border-outline-variant/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderIcon
                      name={folder.icon || (isCollection ? "Layers" : "Folder")}
                      color={folder.color || "var(--color-primary, #6366f1)"}
                      className="w-4 h-4 shrink-0 transition-colors"
                    />
                    <h3 className="text-xs font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                      {folder.name}
                    </h3>
                  </div>

                  {/* Item / Sub-album count aligned cleanly underneath the title */}
                  <div className="flex items-center gap-1.5 mt-1.5 pl-6">
                    {isCollection ? (
                      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container text-[11px] font-medium text-primary">
                        <Layers className="w-3 h-3 text-primary" />
                        <span className="font-semibold font-mono">{folder.sub_album_count ?? 0}</span>
                        <span className="text-on-surface-variant">
                          {(folder.sub_album_count ?? 0) === 1 ? "album" : "albums"}
                        </span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface-container text-[11px] font-medium text-on-surface">
                        <Images className="w-3 h-3 text-primary" />
                        <span className="font-semibold font-mono">{folder.item_count}</span>
                        <span className="text-on-surface-variant">
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-surface-container-low/95 backdrop-blur-md border border-outline-variant/20 rounded-2xl p-6 shadow-2xl space-y-4">
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
                className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] transition-colors cursor-pointer"
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
                  className="w-full px-3.5 py-2 rounded-lg bg-surface-container-lowest/80 border border-outline-variant/20 text-on-surface text-sm placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateAsCollection(false);
                  }}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newFolderName.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all cursor-pointer shadow-sm"
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-surface-container-low/95 backdrop-blur-md border border-outline-variant/20 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <FolderInput className="w-5 h-5 text-primary" />
                <span>Move {selectedFolderIds.size} Albums to Collection</span>
              </h3>
              <button
                onClick={() => setShowBulkMoveModal(false)}
                className="p-1 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1 py-1">
              <button
                type="button"
                onClick={() => handleBulkMoveToCollectionConfirm(null)}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-white/[0.06] text-left transition-colors cursor-pointer"
              >
                <span className="text-xs font-semibold text-on-surface">Ungroup (Standalone Albums)</span>
              </button>
              {collections.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => handleBulkMoveToCollectionConfirm(col.id)}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-white/[0.06] text-left transition-colors cursor-pointer"
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
