/**
 * =============================================================================
 * Module: frontend/src/components/Sidebar.tsx
 * Purpose: Silk Cloud neomorphic sidebar with live MTProto telemetry,
 *          album drop targets, keyboard shortcut tags, storage stats, and vault sync.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: Sidebar
 * Side Effects: Triggers view changes, album selection, media drop-to-album assignments,
 *                vault synchronization, and upload triggers.
 * =============================================================================
 */

import React, { useEffect, useState } from "react";
import {
  Clock,
  Folder,
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
} from "lucide-react";
import { CacheStats, FolderItem, MainView, StatsResponse } from "../types";
import { clearLocalCache, fetchCacheStats } from "../api";
import { TeleGalleryLogo } from "./ui/TeleGalleryLogo";

interface SidebarProps {
  currentView: MainView;
  activeFolder: FolderItem | null;
  folders: FolderItem[];
  stats: StatsResponse | null;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onSelectTimeline: () => void;
  onSelectAlbumsOverview: () => void;
  onSelectFolder: (folder: FolderItem) => void;
  onCreateFolder: (name: string) => Promise<void>;
  onDeleteFolder: (folderId: number) => Promise<void>;
  onAddMediaToFolder: (folderId: number, mediaIds: number[]) => Promise<void>;
  onTriggerUpload: () => void;
  onSyncVault?: () => Promise<void>;
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
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onAddMediaToFolder,
  onTriggerUpload,
  onSyncVault,
  isSyncing = false,
}) => {
  const [isAlbumsExpanded, setIsAlbumsExpanded] = useState(true);
  const [showInlineNewAlbum, setShowInlineNewAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [dragOverSidebarFolderId, setDragOverSidebarFolderId] = useState<number | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheToast, setCacheToast] = useState<string | null>(null);

  const loadCacheStats = async () => {
    try {
      const data = await fetchCacheStats();
      setCacheStats(data);
    } catch {}
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
    if (!newAlbumName.trim()) return;

    setIsCreatingAlbum(true);
    try {
      await onCreateFolder(newAlbumName.trim());
      setNewAlbumName("");
      setShowInlineNewAlbum(false);
    } catch (err) {
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
        <div className="flex items-center space-x-3 px-5 py-4 mb-2">
          <TeleGalleryLogo className="w-8 h-8" size={32} />
          <div>
            <h1 className="font-semibold text-lg text-primary tracking-tight">TeleGallery</h1>
            <p className="text-xs text-on-surface-variant font-medium">Cloud Vault</p>
          </div>
          
          {/* Mobile Close Button */}
          <button
            onClick={onCloseMobile}
            className="ml-auto p-1.5 text-on-surface-variant hover:text-on-surface rounded-neo md:hidden neo-raised active:neo-pressed cursor-pointer transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary New Upload Button */}
        <div className="px-4 mb-4">
          <button
            onClick={() => {
              onTriggerUpload();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 neo-button-primary rounded-neo-lg text-sm font-semibold transition-all duration-200 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Media</span>
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-4 space-y-1">
          {/* Photos / Timeline */}
          <button
            onClick={() => {
              onSelectTimeline();
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
              isTimelineActive
                ? "neo-pressed bg-surface-base text-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5" />
              <span>Timeline</span>
            </div>
            {stats && (
              <span className="text-xs px-2 py-0.5 rounded-md neo-pressed bg-surface-base text-on-surface-variant font-mono">
                {stats.total_items}
              </span>
            )}
          </button>

          {/* Albums Section */}
          <div className="pt-4">
            <div className="flex items-center justify-between px-2 py-2 text-xs font-semibold text-on-surface-variant tracking-wider uppercase">
              <button
                onClick={() => setIsAlbumsExpanded((p) => !p)}
                className="flex items-center gap-1.5 hover:text-on-surface cursor-pointer transition-colors duration-200"
              >
                {isAlbumsExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <span>Collections</span>
              </button>

              <button
                onClick={() => setShowInlineNewAlbum(true)}
                className="p-1.5 neo-raised active:neo-pressed rounded-md text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                title="Create New Album"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
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

            {/* Albums List */}
            {isAlbumsExpanded && (
              <div className="space-y-1 mt-1">
                {/* All Albums Overview Link */}
                <button
                  onClick={() => {
                    onSelectAlbumsOverview();
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                    isAlbumsOverviewActive
                      ? "neo-pressed bg-surface-base text-primary"
                      : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FolderPlus className="w-5 h-5" />
                    <span>All Albums</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-md neo-pressed bg-surface-base text-on-surface-variant font-mono">
                    {folders.length}
                  </span>
                </button>

                {/* Individual Album Items (Active Drop Targets) */}
                {folders.map((folder) => {
                  const isSelected = activeFolder?.id === folder.id;
                  const isDragTarget = dragOverSidebarFolderId === folder.id;

                  return (
                    <div
                      key={folder.id}
                      onDragOver={(e) => handleDragOver(e, folder.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, folder.id)}
                      onClick={() => {
                        onSelectFolder(folder);
                        onCloseMobile();
                      }}
                      className={`group flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                        isDragTarget
                          ? "neo-pressed bg-surface-base text-primary ring-2 ring-primary scale-[1.02]"
                          : isSelected
                            ? "neo-pressed bg-surface-base text-primary"
                            : "text-on-surface-variant hover:text-on-surface"
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate pr-2">
                        <Folder
                          className={`w-5 h-5 shrink-0 transition-colors ${
                            isDragTarget || isSelected
                              ? "text-primary"
                              : "text-on-surface-variant group-hover:text-on-surface"
                          }`}
                        />
                        <span className="truncate">{folder.name}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isDragTarget ? (
                          <span className="text-xs font-bold text-primary animate-pulse">
                            Drop
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-md neo-pressed bg-surface-base text-on-surface-variant font-mono">
                            {folder.item_count}
                          </span>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (
                              window.confirm(
                                `Delete album "${folder.name}"? Media will remain in vault.`
                              )
                            ) {
                              onDeleteFolder(folder.id);
                            }
                          }}
                          className="p-1 text-on-surface-variant hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Delete Album"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Vault Storage Stats Widget at Bottom */}
        <div className="p-4 m-3 neo-card rounded-neo-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-on-surface">Telegram Vault</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full neo-pressed bg-surface-base text-[10px] font-semibold text-primary font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span>MTProto</span>
            </div>
          </div>

          {stats ? (
            <div className="space-y-3">
              {/* Storage archived & Unlimited badge */}
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-xl font-bold font-mono text-on-surface tracking-tight drop-shadow-sm">
                    {stats.total_size_formatted}
                  </span>
                  <span className="text-xs text-on-surface-variant block mt-0.5">Archived in Cloud</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg neo-pressed bg-surface-base text-xs font-bold text-primary font-mono">
                  <span>∞</span>
                  <span>Unlmt</span>
                </div>
              </div>

              {/* Photos & Videos Breakdown */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-surface-container-high text-xs">
                <div className="flex items-center gap-2 text-on-surface neo-pressed bg-surface-base px-2.5 py-1.5 rounded-neo">
                  <Images className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{stats.total_photos} items</span>
                </div>
                <div className="flex items-center gap-2 text-on-surface neo-pressed bg-surface-base px-2.5 py-1.5 rounded-neo">
                  <Video className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{stats.total_videos} items</span>
                </div>
              </div>

              {/* Local Disk Cache Meter & 1-Click Purge */}
              {cacheStats && (
                <div className="pt-2 border-t border-surface-container-high space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 text-on-surface-variant">
                      <HardDrive className="w-3.5 h-3.5 text-primary" />
                      <span>Local Cache</span>
                    </div>
                    <span className="font-mono text-on-surface font-medium">
                      {cacheStats.cache_formatted} / {cacheStats.max_formatted}
                    </span>
                  </div>

                  {/* Cache Progress Bar */}
                  <div className="h-1.5 w-full bg-surface-base neo-pressed rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        cacheStats.percent_used > 85
                          ? "bg-error"
                          : cacheStats.percent_used > 60
                          ? "bg-amber-400"
                          : "bg-glow-indigo"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(3, cacheStats.percent_used))}%` }}
                    />
                  </div>

                  {/* Clear Cache Action Button */}
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] text-on-surface-variant">
                      {cacheToast ? (
                        <span className="text-emerald-400 font-medium animate-pulse">{cacheToast}</span>
                      ) : (
                        `LRU Auto-Eviction (${cacheStats.file_count} files)`
                      )}
                    </span>
                    <button
                      onClick={handleClearCache}
                      disabled={isClearingCache || cacheStats.cache_bytes === 0}
                      className="flex items-center gap-1 text-[10px] font-semibold text-on-surface-variant hover:text-emerald-400 disabled:opacity-40 cursor-pointer transition-colors"
                      title="Clear local streaming cache to free disk space"
                    >
                      <Trash2 className={`w-3 h-3 ${isClearingCache ? "animate-spin text-emerald-400" : ""}`} />
                      <span>{isClearingCache ? "Purging..." : "Clear Cache"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Sync Vault Action Button */}
              {onSyncVault && (
                <button
                  onClick={() => onSyncVault()}
                  disabled={isSyncing}
                  className={`w-full mt-2 flex items-center justify-center gap-2 py-2 px-4 rounded-neo-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    isSyncing
                      ? "neo-pressed bg-surface-base text-primary cursor-wait"
                      : "neo-button text-on-surface hover:text-primary"
                  }`}
                  title="Scan Telegram Channel for new media"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-primary" : ""}`} />
                  <span>{isSyncing ? "Syncing..." : "Sync Vault"}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="text-xs text-on-surface-variant py-2">Connecting to Telegram...</div>
          )}
        </div>
      </aside>
    </>
  );
};
