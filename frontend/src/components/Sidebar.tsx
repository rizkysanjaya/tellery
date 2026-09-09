/**
 * =============================================================================
 * Module: frontend/src/components/Sidebar.tsx
 * Purpose: Pro-grade flat obsidian sidebar with hairline dividers, compact vault info
 *          with media breakdown counters and cloud storage size indicator,
 *          vault switcher, album tree, direct favorites navigation, trash,
 *          user account greeting badge with privacy toggle, and settings dialog trigger.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts, FolderIcon, FolderActionMenu,
 *               FolderCustomizeModal, FolderRenameModal, FolderCoverModal, FolderMoveModal
 * Public Members: Sidebar
 * Side Effects: Triggers view changes (timeline, albums, favorites, trash), settings modal,
 *                vault switcher modal, album selection, media drop-to-album assignments,
 *                vault synchronization, upload triggers, and album management modals.
 * =============================================================================
 */

import React, { useMemo, useState } from "react";
import {
  Clock,
  FolderPlus,
  Upload,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Trash2,
  Images,
  Video,
  HardDrive,
  X,
  Loader2,
  Check,
  Cloud,
  RefreshCw,
  Eye,
  EyeOff,
  Settings,
  Star,
  LogOut,
} from "lucide-react";
import { FolderItem, MainView, StatsResponse, VaultItem } from "../types";
import { FolderIcon } from "./ui/FolderIcon";
import { FolderActionMenu } from "./ui/FolderActionMenu";
import { FolderCustomizeModal } from "./ui/FolderCustomizeModal";
import { FolderRenameModal } from "./ui/FolderRenameModal";
import { FolderCoverModal } from "./ui/FolderCoverModal";
import { FolderMoveModal } from "./ui/FolderMoveModal";

interface SidebarProps {
  currentView: MainView;
  activeFolder: FolderItem | null;
  folders: FolderItem[];
  stats: StatsResponse | null;
  activeVault?: VaultItem | null;
  onOpenVaultSwitcher?: () => void;
  onOpenSettings?: () => void;
  canUpload?: boolean;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onSelectTimeline: () => void;
  onSelectAlbumsOverview: () => void;
  onSelectFavorites?: () => void;
  onSelectTrash?: () => void;
  trashCount?: number;
  onLogout?: () => void;
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
  onExportFolderZip?: (folder: FolderItem) => void;
  onFolderContextMenu?: (e: React.MouseEvent, folder: FolderItem) => void;
  isSyncing?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  activeFolder,
  folders,
  stats,
  activeVault = null,
  onOpenVaultSwitcher,
  onOpenSettings,
  canUpload = true,
  isOpenMobile,
  onCloseMobile,
  onSelectTimeline,
  onSelectAlbumsOverview,
  onSelectFavorites,
  onSelectTrash,
  trashCount = 0,
  onLogout,
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
  onExportFolderZip,
  onFolderContextMenu,
  isSyncing = false,
}) => {
  const [isAlbumsExpanded, setIsAlbumsExpanded] = useState(true);
  const [showInlineNewAlbum, setShowInlineNewAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [dragOverSidebarFolderId, setDragOverSidebarFolderId] = useState<number | null>(null);
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
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-outline-variant/10 mb-2">
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-lg text-primary tracking-tight">Tellery</h1>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Sync Vault Action Button with Text */}
            {onSyncVault && (
              <button
                onClick={() => onSyncVault()}
                disabled={isSyncing}
                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
                  isSyncing
                    ? "bg-primary/10 border-primary/20 text-primary cursor-wait"
                    : "border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04]"
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
              className="p-1.5 text-on-surface-variant hover:text-on-surface rounded-md md:hidden hover:bg-white/[0.06] cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Connected To Vault Card (Clickable to switch Telegram Channel Vault) */}
        <div className="px-3 mb-2.5">
          <div
            role="button"
            tabIndex={0}
            onClick={onOpenVaultSwitcher}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenVaultSwitcher?.();
              }
            }}
            className="p-2.5 rounded-lg bg-surface-container-low/40 border border-outline-variant/15 space-y-2 hover:bg-surface-container-high/30 hover:border-outline-variant/30 transition-all cursor-pointer group select-none"
            title="Click to switch Telegram Storage Vault"
          >
            {/* Status indicator & Role Badge & Switcher Chevron */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(16,185,129,0.5)] dark:shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                <span>Connected to</span>
              </div>
              <div className="flex items-center gap-1.5">
                {activeVault && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      activeVault.role === "owner"
                        ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 dark:border-emerald-500/20"
                        : "bg-surface-container text-amber-800 dark:text-amber-400 border border-amber-500/30 dark:border-amber-500/20"
                    }`}
                  >
                    {activeVault.role === "owner" ? "Owner" : "Read-Only"}
                  </span>
                )}
                <ChevronsUpDown className="w-3.5 h-3.5 text-on-surface-variant group-hover:text-primary transition-colors" />
              </div>
            </div>

            {/* Channel Profile Photo & Channel Name */}
            <div className="flex items-center gap-2.5 min-w-0">
              {stats?.channel_avatar_url ? (
                <img
                  src={stats.channel_avatar_url}
                  alt={activeVault?.title || stats.channel_name || "Vault"}
                  className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-primary/30"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Cloud className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <span
                className="text-xs font-semibold text-on-surface truncate tracking-tight group-hover:text-primary transition-colors"
                title={activeVault?.title ? `${activeVault.title} Vault` : stats?.channel_name ? `${stats.channel_name} Vault` : "Telegram Vault"}
              >
                {activeVault?.title ? `${activeVault.title} Vault` : stats?.channel_name ? `${stats.channel_name} Vault` : "Telegram Vault"}
              </span>
            </div>

            {/* Media Breakdown Counters & Storage Size directly beneath Vault */}
            {stats && (
              <div className="space-y-1.5 pt-1.5 border-t border-outline-variant/10 text-xs">
                <div className="grid grid-cols-2 gap-1.5">
                  <div
                    className="flex items-center justify-center gap-1.5 text-on-surface bg-surface-container-lowest/50 border border-outline-variant/10 px-2 py-1 rounded text-[11px] font-medium"
                    title={`${stats.total_photos} Photos / Images`}
                  >
                    <Images className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-mono">{stats.total_photos}</span>
                  </div>
                  <div
                    className="flex items-center justify-center gap-1.5 text-on-surface bg-surface-container-lowest/50 border border-outline-variant/10 px-2 py-1 rounded text-[11px] font-medium"
                    title={`${stats.total_videos} Videos`}
                  >
                    <Video className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-mono">{stats.total_videos}</span>
                  </div>
                </div>

                {/* Storage size info directly beneath media counters */}
                <div
                  className="flex items-center justify-between px-2 py-1 rounded bg-surface-container-lowest/50 border border-outline-variant/10 text-xs"
                  title={`Archived in Cloud: ${stats.total_size_formatted}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <HardDrive className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="font-mono font-bold text-on-surface text-[11px] shrink-0 tracking-tight">
                      {stats.total_size_formatted}
                    </span>
                  </div>
                  <div
                    className="flex items-center justify-center px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant/15 text-[9px] font-semibold text-primary font-mono shrink-0"
                    title="Unlimited Telegram Storage"
                  >
                    <span>∞ UNLIMITED</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Primary New Upload Button */}
        <div className="px-3 mb-3">
          <button
            onClick={() => {
              if (canUpload !== false) {
                onTriggerUpload();
                onCloseMobile();
              }
            }}
            disabled={canUpload === false}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-150 shadow-sm ${
              canUpload === false
                ? "opacity-60 cursor-not-allowed bg-surface-container text-on-surface-variant border border-outline-variant/20"
                : "bg-primary text-on-primary hover:bg-primary/90 active:scale-[0.99] cursor-pointer"
            }`}
            title={canUpload === false ? "Active vault is Read-Only. Cannot upload to joined channels." : "Upload media to Telegram vault"}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{canUpload === false ? "Read-Only Vault" : "Upload Media"}</span>
          </button>
        </div>

        {/* Navigation Section (Google Drive Style Hierarchical Tree) */}
        <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
          {/* 1. Timeline */}
          <div
            onClick={() => {
              onSelectTimeline();
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              isTimelineActive
                ? "bg-white/[0.08] text-primary font-semibold"
                : "text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-3.5" />
              <Clock className={`w-4 h-4 ${isTimelineActive ? "text-primary" : "text-on-surface-variant"}`} />
              <span>Timeline</span>
            </div>
            {stats && (
              <span className="text-[11px] px-1.5 py-0.5 rounded text-on-surface-variant/70 font-mono">
                {stats.total_items}
              </span>
            )}
          </div>

          {/* 2. Favorites (Direct Navigation Link) */}
          <div
            onClick={() => {
              onSelectFavorites?.();
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              currentView === "favorites" && !activeFolder
                ? "bg-white/[0.08] text-primary font-semibold"
                : "text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-3.5" />
              <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
              <span>Favorites</span>
            </div>
          </div>

          {/* 3. Albums (Google Drive style row with expand caret on left) */}
          <div>
            <div
              onClick={() => {
                onSelectAlbumsOverview();
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                isAlbumsOverviewActive
                  ? "bg-white/[0.08] text-primary font-semibold"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAlbumsExpanded((p) => !p);
                  }}
                  className="p-1 -ml-1 text-on-surface-variant hover:text-on-surface rounded transition-colors cursor-pointer"
                >
                  {isAlbumsExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
                <FolderPlus className={`w-4 h-4 ${isAlbumsOverviewActive ? "text-primary" : "text-on-surface-variant"}`} />
                <span className="truncate">Albums</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInlineNewAlbum(true);
                    setIsAlbumsExpanded(true);
                  }}
                  className="p-1 rounded text-on-surface-variant hover:text-primary hover:bg-white/[0.04] transition-colors cursor-pointer"
                  title="Create New Album"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Inline New Album Input */}
            {showInlineNewAlbum && (
              <form
                onSubmit={handleCreateAlbumSubmit}
                className="flex items-center gap-1.5 px-2.5 py-1.5 mt-1 mb-2 bg-surface-container-lowest border border-outline-variant/20 rounded-md transition-all duration-150"
              >
                <input
                  type="text"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  placeholder="Album name..."
                  autoFocus
                  className="flex-1 px-1 bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant/50 outline-none"
                />
                <button
                  type="submit"
                  disabled={isCreatingAlbum || !newAlbumName.trim()}
                  className="p-1 disabled:opacity-50 text-primary hover:bg-white/[0.06] rounded cursor-pointer transition-colors"
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
                  className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06] rounded cursor-pointer transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            {/* Expanded Albums List */}
            {isAlbumsExpanded && (
              <div className="pl-6 pr-1 py-0.5 space-y-0.5">
                {allAlbums.length === 0 && !showInlineNewAlbum ? (
                  <div className="px-2.5 py-1.5 rounded text-[11px] text-on-surface-variant/50 italic">
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
                        className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          isDragTarget
                            ? "bg-primary/20 text-primary ring-1 ring-primary"
                            : isSelected
                              ? "bg-white/[0.08] text-primary font-semibold"
                              : "text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04]"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FolderIcon
                            name={album.icon || "Folder"}
                            color={album.color || (isSelected ? "var(--color-primary, #6366f1)" : undefined)}
                            className="w-3.5 h-3.5 shrink-0"
                          />
                          <span className="truncate">{album.name}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] px-1.5 py-0.5 rounded text-on-surface-variant/60 font-mono">
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
                            onExportZip={onExportFolderZip}
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

          {/* 4. Trash (Data Recovery Vault) */}
          <div
            onClick={() => {
              if (onSelectTrash) {
                onSelectTrash();
                onCloseMobile();
              }
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              currentView === "trash" && !activeFolder
                ? "bg-rose-500/10 text-rose-400 font-semibold"
                : "text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04]"
            }`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-1" />
              <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="truncate">Trash</span>
            </div>
            {typeof trashCount === "number" && (
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded font-mono ${
                  trashCount > 0 ? "text-rose-400 font-semibold" : "text-on-surface-variant/60"
                }`}
              >
                {trashCount}
              </span>
            )}
          </div>
        </div>

        {/* User Account Greeting Badge at Bottom */}
        {stats?.account_name && (
          <div className="px-3 py-2.5 border-t border-outline-variant/10 flex items-center justify-between text-xs mt-auto bg-surface-container-lowest/30">
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
                    className={`w-7 h-7 rounded-full object-cover ring-1 ring-primary/40 transition-all duration-200 ${
                      isIdentityHidden ? "filter blur-[4px] brightness-75 scale-95" : ""
                    }`}
                  />
                ) : (
                  <div
                    className={`w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs shrink-0 transition-all duration-200 ${
                      isIdentityHidden ? "filter blur-[4px]" : ""
                    }`}
                  >
                    {stats.account_name.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Hover Eye Overlay */}
                <div className="absolute inset-0 rounded-full bg-black/60 backdrop-blur-xs flex items-center justify-center text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-150">
                  {isIdentityHidden ? (
                    <Eye className="w-3 h-3 text-primary" />
                  ) : (
                    <EyeOff className="w-3 h-3 text-on-surface" />
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

            <div className="flex items-center gap-1 shrink-0">
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="w-7 h-7 rounded-md hover:bg-white/[0.06] flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                  title="Open Preferences & Settings"
                  aria-label="Preferences"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              )}
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="w-7 h-7 rounded-md hover:bg-rose-500/10 flex items-center justify-center text-on-surface-variant hover:text-rose-400 transition-colors cursor-pointer"
                  title="Disconnect Telegram Session / Log Out"
                  aria-label="Log Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </aside>

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
