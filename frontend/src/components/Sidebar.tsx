/**
 * =============================================================================
 * Module: frontend/src/components/Sidebar.tsx
 * Purpose: Silk Cloud neomorphic sidebar with live MTProto telemetry,
 *          album drop targets, keyboard shortcut tags, storage stats, vault sync,
 *          Favorites section, Collections accordion, right-click context menu triggers,
 *          and 3-dots action menu (customize icon/color, change cover thumbnail, rename, move to collection, delete).
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts, FolderIcon, FolderActionMenu, FolderCustomizeModal, FolderRenameModal, FolderCoverModal, FolderMoveModal
 * Public Members: Sidebar
 * Side Effects: Triggers view changes, album selection, media drop-to-album assignments, right-click context menu,
 *                vault synchronization, upload triggers, folder rename, customize, collection grouping, cover thumbnail selection, and favorite toggling.
 * =============================================================================
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Clock,
  FolderPlus,
  Upload,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  Images,
  Video,
  X,
  Loader2,
  Check,
  Cloud,
  RefreshCw,
  HardDrive,
  Eye,
  EyeOff,
  Settings,
  Star,
} from "lucide-react";
import { CacheStats, FolderItem, MainView, StatsResponse } from "../types";
import { clearLocalCache, fetchCacheStats, updateCacheLimit } from "../api";
import { FolderIcon } from "./ui/FolderIcon";
import { FolderActionMenu } from "./ui/FolderActionMenu";
import { FolderCustomizeModal } from "./ui/FolderCustomizeModal";
import { FolderRenameModal } from "./ui/FolderRenameModal";
import { FolderCoverModal } from "./ui/FolderCoverModal";
import { FolderMoveModal } from "./ui/FolderMoveModal";
import { LiquidProgressBar } from "./ui/LiquidProgressBar";

interface SidebarProps {
  currentView: MainView;
  activeFolder: FolderItem | null;
  folders: FolderItem[];
  stats: StatsResponse | null;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onSelectTimeline: () => void;
  onSelectAlbumsOverview: () => void;
  onSelectFavorites?: () => void;
  onSelectFolder: (folder: FolderItem) => void;
  onCreateFolder: (name: string, isCollection?: boolean) => Promise<void>;
  onDeleteFolder: (folder: FolderItem | number) => void | Promise<void>;
  onRenameFolder?: (folderId: number, newName: string) => Promise<void>;
  onCustomizeFolder?: (folderId: number, color: string | null, icon: string) => Promise<void>;
  onSetFolderCover?: (folderId: number, mediaId: number | null) => Promise<void>;
  onToggleFavoriteFolder?: (folderId: number, isFavorite: boolean) => Promise<void>;
  onMoveFolderToCollection?: (folderId: number, collectionId: number | null) => Promise<void>;
  onAddMediaToFolder: (folderId: number, mediaIds: number[]) => Promise<void>;
  onTriggerUpload: () => void;
  onSyncVault?: () => Promise<void>;
  onFolderContextMenu?: (e: React.MouseEvent, folder: FolderItem) => void;
  isSyncing?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  activeFolder,
  folders,
  stats,
  isOpenMobile,
  onCloseMobile,
  onSelectTimeline,
  onSelectAlbumsOverview,
  onSelectFavorites,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  onCustomizeFolder,
  onSetFolderCover,
  onToggleFavoriteFolder,
  onMoveFolderToCollection,
  onAddMediaToFolder,
  onTriggerUpload,
  onSyncVault,
  onFolderContextMenu,
  isSyncing = false,
}) => {
  const [isAlbumsExpanded, setIsAlbumsExpanded] = useState(true);
  const [isFavoritesExpanded, setIsFavoritesExpanded] = useState(true);
  const [showInlineNewAlbum, setShowInlineNewAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [dragOverSidebarFolderId, setDragOverSidebarFolderId] = useState<number | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheToast, setCacheToast] = useState<string | null>(null);
  const [folderToCustomize, setFolderToCustomize] = useState<FolderItem | null>(null);
  const [folderToRename, setFolderToRename] = useState<FolderItem | null>(null);
  const [folderToCover, setFolderToCover] = useState<FolderItem | null>(null);
  const [folderToMove, setFolderToMove] = useState<FolderItem | null>(null);

  // Split into Collections vs All Albums
  const collections = useMemo(() => {
    return folders.filter((f) => f.is_collection);
  }, [folders]);

  const allAlbums = useMemo(() => {
    return folders.filter((f) => !f.is_collection);
  }, [folders]);

  const [isVaultCollapsed, setIsVaultCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("tg_sidebar_vault_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleVaultCollapse = () => {
    setIsVaultCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("tg_sidebar_vault_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const [isIdentityHidden, setIsIdentityHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem("tg_sidebar_hide_identity") === "true";
    } catch {
      return false;
    }
  });

  const toggleHideIdentity = () => {
    setIsIdentityHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("tg_sidebar_hide_identity", String(next));
      } catch {}
      return next;
    });
  };

  const loadCacheStats = async () => {
    try {
      const data = await fetchCacheStats();
      setCacheStats(data);
    } catch {}
  };

  const [showCacheLimitModal, setShowCacheLimitModal] = useState(false);
  const [customLimitGb, setCustomLimitGb] = useState<string>("2");
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);

  const handleSaveCacheLimit = async (bytes: number) => {
    setIsUpdatingLimit(true);
    try {
      const updated = await updateCacheLimit(bytes);
      setCacheStats(updated);
      setShowCacheLimitModal(false);
      setCacheToast("Limit updated!");
      setTimeout(() => setCacheToast(null), 3000);
    } catch (err) {
      console.error("Failed to update cache limit:", err);
    } finally {
      setIsUpdatingLimit(false);
    }
  };

  useEffect(() => {
    loadCacheStats();
    const interval = setInterval(loadCacheStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleClearCache = async () => {
    if (isClearingCache) return;
    setIsClearingCache(true);
    try {
      const result = await clearLocalCache();
      setCacheToast(`Reclaimed ${result.freed_formatted}`);
      setTimeout(() => setCacheToast(null), 3000);
      await loadCacheStats();
    } catch (err) {
      console.error("Failed to clear cache:", err);
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleCreateAlbumSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newAlbumName.trim();
    if (!cleanName) return;

    setIsCreatingAlbum(true);
    try {
      await onCreateFolder(cleanName, false);
      setNewAlbumName("");
      setShowInlineNewAlbum(false);
    } catch (err: any) {
      console.error("Failed to create album:", err);
    } finally {
      setIsCreatingAlbum(false);
    }
  };

  const handleDragOver = (e: React.DragEvent, folderId: number) => {
    if (
      e.dataTransfer.types.includes("application/telegallery-media") ||
      e.dataTransfer.types.includes("application/json")
    ) {
      e.preventDefault();
      e.stopPropagation();
      setDragOverSidebarFolderId(folderId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSidebarFolderId(null);
  };

  const handleDrop = async (e: React.DragEvent, folderId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSidebarFolderId(null);

    try {
      const rawData = e.dataTransfer.getData("application/json");
      if (rawData) {
        const mediaIds = JSON.parse(rawData) as number[];
        if (Array.isArray(mediaIds) && mediaIds.length > 0) {
          await onAddMediaToFolder(folderId, mediaIds);
        }
      }
    } catch (err) {
      console.error("Failed to drop onto sidebar album:", err);
    }
  };

  const isTimelineActive = currentView === "timeline" && !activeFolder;
  const isAlbumsOverviewActive = currentView === "albums" && !activeFolder;

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 md:z-20 w-64 bg-background border-r border-outline-variant/15 flex flex-col transition-transform duration-300 ease-in-out select-none ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-4 mb-1">
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-xl text-primary tracking-tight">TeleGallery</h1>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Sync Vault Action Button with Text */}
            {onSyncVault && (
              <button
                onClick={() => onSyncVault()}
                disabled={isSyncing}
                className={`px-3 py-1.5 rounded-neo text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSyncing
                    ? "neo-pressed bg-surface-base text-primary cursor-wait"
                    : "neo-button text-on-surface-variant hover:text-primary active:neo-pressed"
                }`}
                title={isSyncing ? "Syncing vault with Telegram..." : "Sync Vault (scan for new media)"}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-primary" : ""}`} />
                <span>{isSyncing ? "Syncing..." : "Sync"}</span>
              </button>
            )}

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-neo md:hidden neo-raised active:neo-pressed cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Connected To Vault Card (above Upload Media button) */}
        <div className="px-4 mb-3">
          <div className="p-3 rounded-neo-xl neo-card bg-surface-container-low/70 border border-outline-variant/20 shadow-xs space-y-2">
            {/* Status indicator: Connected to */}
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span>Connected to</span>
            </div>

            {/* Channel Profile Photo & Channel Name */}
            <div className="flex items-center gap-2.5 min-w-0">
              {stats?.channel_avatar_url ? (
                <img
                  src={stats.channel_avatar_url}
                  alt={stats.channel_name || "Vault"}
                  className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-primary/30 shadow-sm"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary/10 neo-pressed flex items-center justify-center text-primary shrink-0 shadow-inner">
                  <Cloud className="w-4 h-4 text-primary" />
                </div>
              )}
              <span
                className="text-sm font-bold text-on-surface truncate tracking-tight"
                title={stats?.channel_name ? `${stats.channel_name} Vault` : "Telegram Vault"}
              >
                {stats?.channel_name ? `${stats.channel_name} Vault` : "Telegram Vault"}
              </span>
            </div>

            {/* Media Breakdown Counters directly beneath Seulchive Vault */}
            {stats && (
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-outline-variant/10 text-xs">
                <div
                  className="flex items-center justify-center gap-2 text-on-surface neo-pressed bg-surface-base px-2.5 py-1.5 rounded-neo font-semibold"
                  title={`${stats.total_photos} Photos / Images`}
                >
                  <Images className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-mono">{stats.total_photos}</span>
                </div>
                <div
                  className="flex items-center justify-center gap-2 text-on-surface neo-pressed bg-surface-base px-2.5 py-1.5 rounded-neo font-semibold"
                  title={`${stats.total_videos} Videos`}
                >
                  <Video className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-mono">{stats.total_videos}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Primary New Upload Button */}
        <div className="px-4 mb-4">
          <button
            onClick={() => {
              onTriggerUpload();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 neo-button-primary rounded-neo-lg text-sm font-bold transition-all duration-200 cursor-pointer shadow-sm"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Media</span>
          </button>
        </div>

        {/* Navigation Section (Google Drive Style Hierarchical Tree) */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          {/* 1. Timeline */}
          <div
            onClick={() => {
              onSelectTimeline();
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-neo-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
              isTimelineActive
                ? "bg-primary/15 text-primary shadow-xs ring-1 ring-primary/30"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-3.5" />
              <Clock className={`w-4.5 h-4.5 ${isTimelineActive ? "text-primary" : "text-on-surface-variant"}`} />
              <span>Timeline</span>
            </div>
            {stats && (
              <span className="text-xs px-2 py-0.5 rounded-md neo-pressed bg-surface-base text-on-surface-variant font-mono">
                {stats.total_items}
              </span>
            )}
          </div>

          {/* 2. Favorites (Google Drive style with expand caret) */}
          <div>
            <div
              onClick={() => {
                if (onSelectFavorites) {
                  onSelectFavorites();
                  onCloseMobile();
                } else {
                  setIsFavoritesExpanded((p) => !p);
                }
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-neo-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                currentView === "favorites" && !activeFolder
                  ? "neo-pressed bg-surface-base text-primary shadow-inner"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50"
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsFavoritesExpanded((p) => !p);
                  }}
                  className="p-1 -ml-1 text-on-surface-variant hover:text-on-surface rounded transition-colors cursor-pointer"
                >
                  {isFavoritesExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
                <Star className="w-4.5 h-4.5 text-amber-400 fill-amber-400 shrink-0" />
                <span className="truncate">Favorites</span>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-md neo-pressed bg-surface-base text-amber-400/90 font-mono">
                {folders.filter((f) => f.is_favorite).length}
              </span>
            </div>

            {/* Expanded Favorites Sub-items */}
            {isFavoritesExpanded && (
              <div className="pl-6 pr-1 py-1 space-y-1">
                {folders.filter((f) => f.is_favorite).length === 0 ? (
                  <div className="px-3 py-2 rounded-neo neo-pressed bg-surface-container/20 text-xs text-on-surface-variant/60 italic">
                    Star albums to see them here
                  </div>
                ) : (
                  folders
                    .filter((f) => f.is_favorite)
                    .map((folder) => {
                      const isSelected = activeFolder?.id === folder.id;
                      return (
                        <div
                          key={`fav-${folder.id}`}
                          onClick={() => {
                            onSelectFolder(folder);
                            onCloseMobile();
                          }}
                          onContextMenu={(e) => {
                            if (onFolderContextMenu) {
                              e.preventDefault();
                              e.stopPropagation();
                              onFolderContextMenu(e, folder);
                            }
                          }}
                          className={`group flex items-center justify-between px-3 py-2 rounded-neo text-xs font-semibold transition-all duration-150 cursor-pointer ${
                            isSelected
                              ? "bg-primary/15 text-primary shadow-xs ring-1 ring-primary/30"
                              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/40"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate pr-2">
                            <FolderIcon
                              name={folder.icon || "Folder"}
                              color={folder.color || "var(--color-primary, #6366f1)"}
                              className="w-4 h-4 shrink-0"
                            />
                            <span className="truncate">{folder.name}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[11px] px-1.5 py-0.5 rounded neo-pressed bg-surface-base text-on-surface-variant font-mono">
                              {folder.item_count}
                            </span>
                            <FolderActionMenu
                              folder={folder}
                              collections={collections}
                              placement="right"
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
                              triggerClassName="opacity-0 group-hover:opacity-100"
                            />
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            )}
          </div>

          {/* 3. Albums (Google Drive style row with expand caret on left) */}
          <div>
            <div
              onClick={() => {
                onSelectAlbumsOverview();
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-neo-lg text-sm font-semibold transition-all duration-150 cursor-pointer ${
                isAlbumsOverviewActive
                  ? "bg-primary/15 text-primary shadow-xs ring-1 ring-primary/30"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50"
              }`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAlbumsExpanded((p) => !p);
                  }}
                  className="p-1 -ml-1 text-on-surface-variant hover:text-on-surface rounded transition-colors"
                >
                  {isAlbumsExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
                <FolderPlus className={`w-4.5 h-4.5 ${isAlbumsOverviewActive ? "text-primary" : "text-on-surface-variant"}`} />
                <span className="truncate">Albums</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInlineNewAlbum(true);
                    setIsAlbumsExpanded(true);
                  }}
                  className="p-1 rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                  title="Create New Album"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Inline New Album Input */}
            {showInlineNewAlbum && (
              <form
                onSubmit={handleCreateAlbumSubmit}
                className="flex items-center gap-2 px-3 py-2 mt-1 mb-2 neo-pressed bg-surface-base rounded-neo-lg transition-all duration-200"
              >
                <input
                  type="text"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  placeholder="Album name..."
                  autoFocus
                  className="flex-1 px-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant outline-none"
                />
                <button
                  type="submit"
                  disabled={isCreatingAlbum || !newAlbumName.trim()}
                  className="p-1.5 neo-raised active:neo-pressed disabled:opacity-50 text-primary rounded-md cursor-pointer transition-all"
                >
                  {isCreatingAlbum ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInlineNewAlbum(false)}
                  className="p-1.5 neo-raised active:neo-pressed text-on-surface-variant hover:text-on-surface rounded-md cursor-pointer transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            {/* Expanded Albums List */}
            {isAlbumsExpanded && (
              <div className="pl-6 pr-1 py-1 space-y-1">
                {allAlbums.length === 0 && !showInlineNewAlbum ? (
                  <div className="px-3 py-2 rounded-neo neo-pressed bg-surface-container/20 text-xs text-on-surface-variant/60 italic">
                    No albums created yet
                  </div>
                ) : (
                  allAlbums.map((album) => {
                    const isSelected = activeFolder?.id === album.id;
                    const isDragTarget = dragOverSidebarFolderId === album.id;

                    return (
                      <div
                        key={album.id}
                        onDragOver={(e) => handleDragOver(e, album.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, album.id)}
                        onClick={() => {
                          onSelectFolder(album);
                          onCloseMobile();
                        }}
                        onContextMenu={(e) => {
                          if (onFolderContextMenu) {
                            e.preventDefault();
                            e.stopPropagation();
                            onFolderContextMenu(e, album);
                          }
                        }}
                        className={`group flex items-center justify-between px-3 py-2 rounded-neo text-xs font-semibold transition-all duration-150 cursor-pointer ${
                          isDragTarget
                            ? "neo-pressed bg-surface-base text-primary ring-2 ring-primary"
                            : isSelected
                              ? "bg-primary/15 text-primary shadow-xs ring-1 ring-primary/30"
                              : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate pr-2">
                          <FolderIcon
                            name={album.icon || "Folder"}
                            color={album.color || (isSelected ? "var(--color-primary, #6366f1)" : undefined)}
                            className="w-4 h-4 shrink-0"
                          />
                          <span className="truncate">{album.name}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[11px] px-1.5 py-0.5 rounded neo-pressed bg-surface-base text-on-surface-variant font-mono">
                            {album.item_count}
                          </span>
                          <FolderActionMenu
                            folder={album}
                            collections={collections}
                            placement="right"
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
                            triggerClassName="opacity-0 group-hover:opacity-100"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Vault Storage Stats Widget at Bottom (Collapsible) */}
        {!isVaultCollapsed && stats && (
          <div className="p-4 m-3 neo-card rounded-neo-xl space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="space-y-3">
              {/* Storage archived & Unlimited badge */}
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-xl font-bold font-mono text-on-surface tracking-tight drop-shadow-sm">
                    {stats.total_size_formatted}
                  </span>
                  <span className="text-xs text-on-surface-variant block mt-0.5 font-medium">Archived in Cloud</span>
                </div>
                <div className="flex items-center justify-center px-2.5 py-1 rounded-lg neo-pressed bg-surface-base text-sm font-bold text-primary font-mono shadow-inner" title="Unlimited Storage">
                  <span>∞</span>
                </div>
              </div>

                {/* Local Disk Cache Meter & 1-Click Purge */}
                {cacheStats && (
                  <div className="pt-2.5 border-t border-surface-container-high space-y-2">
                    {/* 1. Label */}
                    <div className="flex items-center gap-1.5 text-on-surface-variant font-medium text-xs">
                      <HardDrive className="w-3.5 h-3.5 text-primary" />
                      <span>Local Cache</span>
                    </div>

                    {/* 2. Numbers: Stacked between label and bar */}
                    <div className="flex items-baseline justify-between font-mono">
                      <span className="text-sm font-bold text-on-surface">
                        {cacheStats.cache_formatted}
                      </span>
                      <span className="text-xs text-on-surface-variant font-medium">
                        / {cacheStats.max_formatted} ({cacheStats.percent_used}%)
                      </span>
                    </div>

                    {/* 3. Cache Progress Bar (Liquid Theme) */}
                    <LiquidProgressBar
                      progress={cacheStats.percent_used}
                      height="h-2.5"
                      color={
                        cacheStats.percent_used > 85
                          ? "error"
                          : cacheStats.percent_used > 60
                          ? "amber"
                          : "indigo"
                      }
                      isPulsing={isClearingCache}
                    />

                    {/* Action Buttons: Obvious Clear Cache Button + Gears Setting Button */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        onClick={handleClearCache}
                        disabled={isClearingCache || cacheStats.cache_bytes === 0}
                        className={`flex-1 py-1.5 px-3 rounded-neo-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isClearingCache
                            ? "neo-pressed bg-surface-base text-emerald-400 cursor-wait"
                            : cacheStats.cache_bytes === 0
                            ? "opacity-50 cursor-not-allowed bg-surface-base/50 text-on-surface-variant"
                            : "neo-button bg-surface-base text-on-surface hover:text-red-400 active:neo-pressed"
                        }`}
                        title="Clear local streaming cache to free disk space"
                      >
                        <Trash2 className={`w-3.5 h-3.5 ${isClearingCache ? "animate-spin text-emerald-400" : ""}`} />
                        <span>{isClearingCache ? "Purging..." : cacheToast || "Clear Cache"}</span>
                      </button>

                      <button
                        onClick={() => {
                          const currentGb = (cacheStats.max_bytes / (1024 * 1024 * 1024)).toFixed(1).replace(/\.0$/, "");
                          setCustomLimitGb(currentGb);
                          setShowCacheLimitModal(true);
                        }}
                        className="p-1.5 rounded-neo-lg neo-button bg-surface-base text-on-surface-variant hover:text-primary active:neo-pressed flex items-center justify-center transition-all cursor-pointer shrink-0"
                        title="Adjust maximum cache size limit"
                        aria-label="Adjust Cache Limit"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
          </div>
        )}

        {/* User Account Greeting Badge at Bottom */}
        {stats?.account_name && (
          <div className="px-4 py-3 border-t border-outline-variant/10 flex items-center justify-between text-xs mt-auto bg-surface-container-lowest/40">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {/* Profile Avatar with Hover Eye Privacy Toggle */}
              <div
                onClick={toggleHideIdentity}
                className="relative group/avatar cursor-pointer shrink-0 rounded-full select-none"
                title={isIdentityHidden ? "Show Identity" : "Hide Identity (Incognito)"}
              >
                {stats.user_avatar_url ? (
                  <img
                    src={stats.user_avatar_url}
                    alt={stats.account_name}
                    className={`w-8 h-8 rounded-full object-cover ring-1 ring-primary/40 shadow-inner transition-all duration-200 ${
                      isIdentityHidden ? "filter blur-[4px] brightness-75 scale-95" : ""
                    }`}
                  />
                ) : (
                  <div
                    className={`w-8 h-8 rounded-full bg-primary/10 neo-pressed flex items-center justify-center text-primary font-bold text-xs shrink-0 shadow-inner transition-all duration-200 ${
                      isIdentityHidden ? "filter blur-[4px]" : ""
                    }`}
                  >
                    {stats.account_name.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Hover Eye Overlay */}
                <div className="absolute inset-0 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-150 shadow-md">
                  {isIdentityHidden ? (
                    <Eye className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-on-surface" />
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-on-surface-variant block leading-none mb-0.5">Welcome,</span>
                <span
                  className={`text-xs font-semibold text-on-surface truncate block transition-all duration-200 ${
                    isIdentityHidden ? "filter blur-[4px] select-none text-on-surface-variant" : ""
                  }`}
                  title={isIdentityHidden ? "Hidden Identity" : stats.account_name}
                >
                  {isIdentityHidden ? "••••••••••" : stats.account_name}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={toggleVaultCollapse}
                className="w-7 h-7 rounded-full neo-button flex items-center justify-center text-on-surface-variant hover:text-primary transition-all cursor-pointer"
                title={isVaultCollapsed ? "Expand Vault Info" : "Collapse Vault Info"}
                aria-label="Toggle Vault Info"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isVaultCollapsed ? "rotate-180 text-primary" : "rotate-0"
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Cache Limit Configuration Modal */}
      {showCacheLimitModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="max-w-sm w-full bg-surface-base rounded-neo-xl p-6 neo-card space-y-5 border border-outline-variant/15 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-neo bg-primary/10 neo-pressed flex items-center justify-center text-primary">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-on-surface">Max Cache Limit</h4>
                  <p className="text-[11px] text-on-surface-variant">Adjust local disk limit for streaming</p>
                </div>
              </div>
              <button
                onClick={() => setShowCacheLimitModal(false)}
                className="p-1 text-on-surface-variant hover:text-on-surface rounded-neo neo-button cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block">
                Quick Presets
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "500 MB", bytes: 500 * 1024 * 1024 },
                  { label: "1.5 GB", bytes: 1500 * 1024 * 1024 },
                  { label: "3.0 GB", bytes: 3000 * 1024 * 1024 },
                  { label: "5.0 GB", bytes: 5000 * 1024 * 1024 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handleSaveCacheLimit(preset.bytes)}
                    disabled={isUpdatingLimit}
                    className={`py-2 px-1 rounded-neo text-xs font-semibold transition-all cursor-pointer ${
                      cacheStats && Math.abs(cacheStats.max_bytes - preset.bytes) < 100 * 1024 * 1024
                        ? "neo-pressed bg-surface-base text-primary ring-1 ring-primary/40"
                        : "neo-button bg-surface-base text-on-surface hover:text-primary"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block">
                Custom Limit (GB)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.2"
                  max="100"
                  step="0.5"
                  value={customLimitGb}
                  onChange={(e) => setCustomLimitGb(e.target.value)}
                  placeholder="2.0"
                  className="flex-1 px-3.5 py-2 rounded-neo neo-pressed bg-surface-container-lowest text-on-surface text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={() => {
                    const gb = parseFloat(customLimitGb);
                    if (!isNaN(gb) && gb >= 0.1) {
                      handleSaveCacheLimit(Math.round(gb * 1024 * 1024 * 1024));
                    }
                  }}
                  disabled={isUpdatingLimit || !customLimitGb}
                  className="px-4 py-2 rounded-neo neo-button text-xs font-bold text-primary hover:text-primary/80 disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingLimit ? "Saving..." : "Apply"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Album Customize Modal */}
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

      {/* Album Rename Modal */}
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

      {/* Album Cover Thumbnail Modal */}
      {folderToCover && (
        <FolderCoverModal
          folder={folderToCover}
          isOpen={Boolean(folderToCover)}
          onClose={() => setFolderToCover(null)}
          onSaveCover={async (folderId, mediaId) => {
            if (onSetFolderCover) {
              await onSetFolderCover(folderId, mediaId);
            }
          }}
        />
      )}

      {/* Move to Collection Modal */}
      {folderToMove && (
        <FolderMoveModal
          folder={folderToMove}
          collections={collections}
          isOpen={Boolean(folderToMove)}
          onClose={() => setFolderToMove(null)}
          onMove={async (folderId, collectionId) => {
            if (onMoveFolderToCollection) {
              await onMoveFolderToCollection(folderId, collectionId);
            }
          }}
        />
      )}
    </>
  );
};
