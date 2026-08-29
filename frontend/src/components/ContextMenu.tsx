/**
 * =============================================================================
 * Module: frontend/src/components/ContextMenu.tsx
 * Purpose: Context-aware popup menu tailored to current view & targets:
 *          - Media item target (open, select, favorite toggle, move to folder, download, delete)
 *          - Album target (open, rename, customize, move to collection, favorite, delete)
 *          - Collection target (open, rename, customize, delete)
 *          - Timeline empty canvas (select all photos, upload media)
 *          - Albums empty canvas (create new album, create new collection, refresh)
 *          - Active Album/Collection view canvas (upload to this album, select all, rename, back to albums)
 *          Includes hover bridge and debounce protection for submenus and dynamic Light/Dark mode tokens.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: ContextMenu, ContextMenuPosition
 * Side Effects: Dispatches item selection, favorite toggle, navigation, deletion, creation, and upload events.
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
  Layers,
  Edit2,
  Palette,
  Star,
  RefreshCw,
  FolderInput,
  ArrowLeft,
} from "lucide-react";
import { FolderItem, MediaItem, MainView } from "../types";

export interface ContextMenuPosition {
  x: number;
  y: number;
  targetType: "media" | "folder" | "canvas";
  targetItem?: MediaItem | null;
  targetFolder?: FolderItem | null;
}

interface ContextMenuProps {
  position: ContextMenuPosition;
  currentView: MainView;
  activeFolder: FolderItem | null;
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
  onCreateFolder: (name: string, isCollection?: boolean) => Promise<void>;
  onSelectFolder?: (folder: FolderItem) => void;
  onRenameFolder?: (folder: FolderItem) => void;
  onCustomizeFolder?: (folder: FolderItem) => void;
  onSetFolderCover?: (folder: FolderItem) => void;
  onOpenMoveModal?: (folder: FolderItem) => void;
  onToggleFavoriteFolder?: (folderId: number, isFavorite: boolean) => void;
  onToggleFavoriteMedia?: (mediaId: number, isFavorite: boolean) => void;
  onDeleteFolder?: (folder: FolderItem | number) => void;
  onBackToOverview?: () => void;
  onRefreshData?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  position,
  currentView,
  activeFolder,
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
  onSelectFolder,
  onRenameFolder,
  onCustomizeFolder,
  onSetFolderCover,
  onOpenMoveModal,
  onToggleFavoriteFolder,
  onToggleFavoriteMedia,
  onDeleteFolder,
  onBackToOverview,
  onRefreshData,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuLeaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showAlbumSubmenu, setShowAlbumSubmenu] = useState(false);
  const [showNewAlbumInput, setShowNewAlbumInput] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmenuMouseEnter = () => {
    if (submenuLeaveTimerRef.current) {
      clearTimeout(submenuLeaveTimerRef.current);
      submenuLeaveTimerRef.current = null;
    }
    setShowAlbumSubmenu(true);
  };

  const handleSubmenuMouseLeave = () => {
    if (submenuLeaveTimerRef.current) {
      clearTimeout(submenuLeaveTimerRef.current);
    }
    submenuLeaveTimerRef.current = setTimeout(() => {
      setShowAlbumSubmenu(false);
    }, 250);
  };

  const { targetType, targetItem, targetFolder } = position;
  const isTargetSelected = targetItem ? selectedIds.has(targetItem.id) : false;

  const effectiveMediaIds = targetItem
    ? isTargetSelected && selectedIds.size > 0
      ? Array.from(selectedIds)
      : [targetItem.id]
    : Array.from(selectedIds);

  const count = effectiveMediaIds.length;

  // Close on outside click, Escape key, or scroll
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        if (submenuLeaveTimerRef.current) {
          clearTimeout(submenuLeaveTimerRef.current);
        }
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (submenuLeaveTimerRef.current) {
          clearTimeout(submenuLeaveTimerRef.current);
        }
        onClose();
      }
    };

    const handleScroll = () => {
      if (submenuLeaveTimerRef.current) {
        clearTimeout(submenuLeaveTimerRef.current);
      }
      onClose();
    };

    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      if (submenuLeaveTimerRef.current) {
        clearTimeout(submenuLeaveTimerRef.current);
      }
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  // Adjust coordinates to keep in viewport
  const menuWidth = 230;
  const menuHeight = targetType === "media" ? 270 : targetType === "folder" ? 250 : 190;
  const screenWidth = typeof window !== "undefined" ? window.innerWidth : 1000;
  const screenHeight = typeof window !== "undefined" ? window.innerHeight : 800;

  const adjustedX = Math.min(Math.max(16, position.x), screenWidth - menuWidth - 16);
  const adjustedY = Math.min(Math.max(16, position.y), screenHeight - menuHeight - 16);

  const submenuWidth = 210;
  const openSubmenuLeft = adjustedX + menuWidth + submenuWidth + 16 > screenWidth;
  const openSubmenuUp = adjustedY + 180 > screenHeight;

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
        await onCreateFolder(newAlbumName.trim(), false);
      }
      setNewAlbumName("");
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteMediaAction = async () => {
    if (count === 0) return;
    setIsProcessing(true);
    try {
      await onDeleteMedia(effectiveMediaIds);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!targetItem) return;
    const a = document.createElement("a");
    a.href = targetItem.stream_url;
    a.download = targetItem.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    onClose();
  };

  const standardFolders = folders.filter((f) => !f.is_collection);

  return (
    <div
      ref={menuRef}
      style={{
        left: `${adjustedX}px`,
        top: `${adjustedY}px`,
      }}
      className="fixed z-50 w-[230px] neo-card bg-surface-base border border-outline-variant/30 shadow-2xl rounded-neo-lg p-1.5 text-xs text-on-surface animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      {/* ------------------------------------------------------------- */}
      {/* CASE 1: TARGET IS A SPECIFIC MEDIA ITEM                       */}
      {/* ------------------------------------------------------------- */}
      {targetType === "media" && targetItem && (
        <>
          <button
            onClick={() => {
              onOpenItem(targetItem);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
          >
            <Maximize2 className="w-4 h-4 text-primary" />
            <span>Open Lightbox</span>
          </button>

          <button
            onClick={() => {
              onToggleSelect(targetItem.id);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
          >
            <CheckSquare className="w-4 h-4 text-on-surface-variant" />
            <span>{isTargetSelected ? "Deselect Item" : "Select Item"}</span>
          </button>

          {onToggleFavoriteMedia && (
            <button
              onClick={() => {
                onToggleFavoriteMedia(targetItem.id, !targetItem.is_favorite);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
            >
              <Star className={`w-4 h-4 ${targetItem.is_favorite ? "text-amber-400 fill-amber-400" : "text-on-surface-variant"}`} />
              <span>{targetItem.is_favorite ? "Remove from Favorites" : "Add to Favorites"}</span>
            </button>
          )}

          {/* Move / Add to Album Submenu */}
          <div
            className="relative"
            onMouseEnter={handleSubmenuMouseEnter}
            onMouseLeave={handleSubmenuMouseLeave}
          >
            <button
              onClick={() => setShowAlbumSubmenu((p) => !p)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <FolderPlus className="w-4 h-4 text-on-surface-variant" />
                <span>{count > 1 ? `Move ${count} to Album` : "Add to Album"}</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant" />
            </button>

            {showAlbumSubmenu && (
              <div
                onMouseEnter={handleSubmenuMouseEnter}
                onMouseLeave={handleSubmenuMouseLeave}
                className={`absolute w-52 neo-card bg-surface-base border border-outline-variant/30 rounded-neo-lg p-2 z-50 shadow-2xl animate-in fade-in zoom-in-95 duration-100 ${
                  openSubmenuLeft ? "right-full mr-1.5" : "left-full ml-1.5"
                } ${openSubmenuUp ? "bottom-0" : "top-0"} before:content-[''] before:absolute before:-top-6 before:-bottom-6 ${
                  openSubmenuLeft ? "before:-right-4 before:w-6" : "before:-left-4 before:w-6"
                }`}
              >
                <div className="text-[11px] font-bold text-on-surface-variant px-2 py-1 border-b border-outline-variant/20 mb-1">
                  Select Target Album
                </div>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {standardFolders.length === 0 && !showNewAlbumInput && (
                    <p className="text-[10px] text-on-surface-variant/60 py-1.5 text-center italic">
                      No albums yet
                    </p>
                  )}
                  {standardFolders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleAddToExistingFolder(folder.id)}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] font-medium text-on-surface hover:bg-surface-container-high hover:text-primary transition-all text-left cursor-pointer disabled:opacity-50"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Folder className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">{folder.name}</span>
                      </div>
                      <span className="text-[10px] text-on-surface-variant shrink-0">
                        {folder.item_count}
                      </span>
                    </button>
                  ))}
                </div>

                {showNewAlbumInput ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleCreateAndAssignAlbum();
                    }}
                    className="flex items-center gap-1 pt-1.5 mt-1 border-t border-outline-variant/20"
                  >
                    <input
                      type="text"
                      value={newAlbumName}
                      onChange={(e) => setNewAlbumName(e.target.value)}
                      placeholder="Album name..."
                      autoFocus
                      className="flex-1 px-2 py-1 bg-surface-container-lowest border border-outline-variant/30 focus:border-primary rounded text-[11px] text-on-surface placeholder:text-on-surface-variant outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isProcessing || !newAlbumName.trim()}
                      className="p-1 neo-button-primary disabled:opacity-50 text-white rounded cursor-pointer"
                    >
                      {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowNewAlbumInput(true)}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-primary hover:bg-surface-container-high transition-all cursor-pointer mt-1 pt-1.5 border-t border-outline-variant/20"
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
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
          >
            <Download className="w-4 h-4 text-on-surface-variant" />
            <span>Download File</span>
          </button>

          <div className="h-px bg-outline-variant/20 my-1" />

          <button
            onClick={handleDeleteMediaAction}
            disabled={isProcessing}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-error-container/20 text-error font-medium transition-all text-left cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            <span>{count > 1 ? `Delete ${count} Items` : "Delete"}</span>
          </button>
        </>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CASE 2: TARGET IS AN ALBUM OR COLLECTION CARD                 */}
      {/* ------------------------------------------------------------- */}
      {targetType === "folder" && targetFolder && (
        <>
          {/* Open Album / Collection */}
          <button
            onClick={() => {
              onSelectFolder?.(targetFolder);
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
          >
            {targetFolder.is_collection ? (
              <Layers className="w-4 h-4 text-primary" />
            ) : (
              <Folder className="w-4 h-4 text-primary" />
            )}
            <span>{targetFolder.is_collection ? "View Collection" : "Open Album"}</span>
          </button>

          {/* Change Cover Thumbnail (Albums only) */}
          {!targetFolder.is_collection && onSetFolderCover && (
            <button
              onClick={() => {
                onSetFolderCover(targetFolder);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
            >
              <Palette className="w-4 h-4 text-primary" />
              <span>Change Cover Thumbnail</span>
            </button>
          )}

          {/* Customize Icon & Color */}
          {onCustomizeFolder && (
            <button
              onClick={() => {
                onCustomizeFolder(targetFolder);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
            >
              <Palette className="w-4 h-4 text-on-surface-variant" />
              <span>Customize Style</span>
            </button>
          )}

          {/* Rename */}
          {onRenameFolder && (
            <button
              onClick={() => {
                onRenameFolder(targetFolder);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
            >
              <Edit2 className="w-4 h-4 text-on-surface-variant" />
              <span>{targetFolder.is_collection ? "Rename Collection" : "Rename Album"}</span>
            </button>
          )}

          {/* Move to Collection (Albums only) */}
          {!targetFolder.is_collection && onOpenMoveModal && (
            <button
              onClick={() => {
                onOpenMoveModal(targetFolder);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
            >
              <FolderInput className="w-4 h-4 text-primary" />
              <span>Move to Collection</span>
            </button>
          )}

          {/* Toggle Favorite (Albums only) */}
          {!targetFolder.is_collection && onToggleFavoriteFolder && (
            <button
              onClick={() => {
                onToggleFavoriteFolder(targetFolder.id, !targetFolder.is_favorite);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
            >
              <Star
                className={`w-4 h-4 ${
                  targetFolder.is_favorite ? "text-amber-400 fill-amber-400" : "text-on-surface-variant"
                }`}
              />
              <span>{targetFolder.is_favorite ? "Remove from Favorites" : "Add to Favorites"}</span>
            </button>
          )}

          <div className="h-px bg-outline-variant/20 my-1" />

          {/* Delete Album or Collection */}
          {onDeleteFolder && (
            <button
              onClick={() => {
                onDeleteFolder(targetFolder);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-error-container/20 text-error font-medium transition-all text-left cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>{targetFolder.is_collection ? "Delete Collection" : "Delete Album"}</span>
            </button>
          )}
        </>
      )}

      {/* ------------------------------------------------------------- */}
      {/* CASE 3: TARGET IS EMPTY CANVAS BACKGROUND                     */}
      {/* ------------------------------------------------------------- */}
      {targetType === "canvas" && (
        <>
          {/* Sub-case 3A: Canvas inside Albums Overview */}
          {currentView === "albums" && !activeFolder && (
            <>
              <button
                onClick={() => {
                  onCreateFolder("", false);
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
              >
                <Plus className="w-4 h-4 text-primary" />
                <span>New Album</span>
              </button>

              <button
                onClick={() => {
                  onCreateFolder("", true);
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
              >
                <Layers className="w-4 h-4 text-primary" />
                <span>New Collection</span>
              </button>

              <div className="h-px bg-outline-variant/20 my-1" />

              <button
                onClick={() => {
                  onTriggerUpload();
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
              >
                <Upload className="w-4 h-4 text-on-surface-variant" />
                <span>Upload Media</span>
              </button>

              {onRefreshData && (
                <button
                  onClick={() => {
                    onRefreshData();
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-on-surface-variant" />
                  <span>Refresh Grid</span>
                </button>
              )}
            </>
          )}

          {/* Sub-case 3B: Canvas inside an Active Album view */}
          {activeFolder && (
            <>
              <button
                onClick={() => {
                  onTriggerUpload();
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
              >
                <Upload className="w-4 h-4 text-primary" />
                <span>Upload to "{activeFolder.name}"</span>
              </button>

              <button
                onClick={() => {
                  onSelectAll();
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
              >
                <CheckSquare className="w-4 h-4 text-on-surface-variant" />
                <span>Select All in Album</span>
              </button>

              {onCustomizeFolder && (
                <button
                  onClick={() => {
                    onCustomizeFolder(activeFolder);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
                >
                  <Palette className="w-4 h-4 text-on-surface-variant" />
                  <span>Customize Album</span>
                </button>
              )}

              <div className="h-px bg-outline-variant/20 my-1" />

              <button
                onClick={() => {
                  onBackToOverview?.();
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-on-surface-variant" />
                <span>Back to Albums</span>
              </button>
            </>
          )}

          {/* Sub-case 3C: Canvas on Main Timeline View */}
          {currentView === "timeline" && !activeFolder && (
            <>
              <button
                onClick={() => {
                  onSelectAll();
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
              >
                <CheckSquare className="w-4 h-4 text-on-surface-variant" />
                <span>Select All Photos</span>
              </button>

              <button
                onClick={() => {
                  onTriggerUpload();
                  onClose();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-neo hover:bg-surface-container-high text-on-surface font-medium transition-all text-left cursor-pointer"
              >
                <Upload className="w-4 h-4 text-primary" />
                <span>Upload Media</span>
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};