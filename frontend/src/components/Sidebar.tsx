/**
 * =============================================================================
 * Module: frontend/src/components/Sidebar.tsx
 * Purpose: Persistent Google Drive-style left navigation drawer with album tree,
 *          drag-and-drop targets on sidebar albums, upload action, and vault storage stats.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: Sidebar
 * Side Effects: Triggers view changes, album selection, media drop-to-album assignments,
 *                and upload triggers.
 * =============================================================================
 */

import React, { useState } from "react";
import {
  Layers,
  Clock,
  Folder,
  FolderPlus,
  HardDrive,
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
} from "lucide-react";
import { FolderItem, MainView, StatsResponse } from "../types";

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
}) => {
  const [isAlbumsExpanded, setIsAlbumsExpanded] = useState(true);
  const [showInlineNewAlbum, setShowInlineNewAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [dragOverSidebarFolderId, setDragOverSidebarFolderId] = useState<number | null>(null);

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
    if (e.dataTransfer.types.includes("application/json")) {
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
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 md:z-20 w-64 bg-zinc-950/95 md:bg-zinc-950/70 md:backdrop-blur-md border-r border-zinc-800/80 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                TeleGallery
                <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/20">
                  Vault
                </span>
              </h1>
            </div>
          </div>

          {/* Mobile Close Button */}
          <button
            onClick={onCloseMobile}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg md:hidden cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary New Upload Button */}
        <div className="p-4 pb-2">
          <button
            onClick={() => {
              onTriggerUpload();
              onCloseMobile();
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Media</span>
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {/* Photos / Timeline */}
          <button
            onClick={() => {
              onSelectTimeline();
              onCloseMobile();
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isTimelineActive
                ? "bg-sky-500/15 text-sky-400 border border-sky-500/20"
                : "text-zinc-300 hover:text-white hover:bg-zinc-900"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>Timeline</span>
            </div>
            {stats && (
              <span className="text-[11px] text-zinc-500 font-medium">
                {stats.total_items}
              </span>
            )}
          </button>

          {/* Albums Section */}
          <div className="pt-3">
            <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-bold text-zinc-400">
              <button
                onClick={() => setIsAlbumsExpanded((p) => !p)}
                className="flex items-center gap-1.5 hover:text-zinc-200 cursor-pointer"
              >
                {isAlbumsExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                <span>ALBUMS</span>
              </button>

              <button
                onClick={() => setShowInlineNewAlbum(true)}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-sky-400 cursor-pointer"
                title="Create New Album"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Inline New Album Input */}
            {showInlineNewAlbum && (
              <form
                onSubmit={handleCreateAlbumSubmit}
                className="flex items-center gap-1 px-3 py-1.5 mt-1 mb-2 bg-zinc-900 rounded-xl border border-zinc-800"
              >
                <input
                  type="text"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  placeholder="Album name..."
                  autoFocus
                  className="flex-1 px-1.5 py-1 bg-transparent text-xs text-zinc-100 placeholder-zinc-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={isCreatingAlbum || !newAlbumName.trim()}
                  className="p-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded cursor-pointer"
                >
                  {isCreatingAlbum ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInlineNewAlbum(false)}
                  className="p-1 text-zinc-400 hover:text-white rounded cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </form>
            )}

            {/* Albums List */}
            {isAlbumsExpanded && (
              <div className="space-y-0.5 mt-1 pl-2">
                {/* All Albums Overview Link */}
                <button
                  onClick={() => {
                    onSelectAlbumsOverview();
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isAlbumsOverviewActive
                      ? "bg-sky-500/15 text-sky-400 border border-sky-500/20"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FolderPlus className="w-3.5 h-3.5 text-zinc-500" />
                    <span>All Albums Grid</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-medium">
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
                      className={`group flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        isDragTarget
                          ? "bg-sky-500/30 text-sky-300 border border-sky-400 ring-2 ring-sky-500/30 scale-[1.02]"
                          : isSelected
                            ? "bg-sky-500/15 text-sky-400 border border-sky-500/20"
                            : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <Folder
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isDragTarget || isSelected ? "text-sky-400" : "text-zinc-500 group-hover:text-zinc-400"
                          }`}
                        />
                        <span className="truncate">{folder.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isDragTarget ? (
                          <span className="text-[10px] font-bold text-sky-300 animate-pulse">
                            Drop
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500">
                            {folder.item_count}
                          </span>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete album "${folder.name}"? Media will remain in vault.`)) {
                              onDeleteFolder(folder.id);
                            }
                          }}
                          className="p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Delete Album"
                        >
                          <Trash2 className="w-3 h-3" />
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
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/60">
          <div className="flex items-center gap-2.5 mb-2">
            <HardDrive className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold text-zinc-200">Storage Vault</span>
          </div>

          {stats ? (
            <div className="space-y-1.5 text-[11px] text-zinc-400">
              <div className="flex items-center justify-between">
                <span>Total Size:</span>
                <span className="font-semibold text-zinc-200">{stats.total_size_formatted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Images className="w-3 h-3 text-sky-400" /> Photos
                </span>
                <span className="text-zinc-300">{stats.total_photos}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Video className="w-3 h-3 text-indigo-400" /> Videos
                </span>
                <span className="text-zinc-300">{stats.total_videos}</span>
              </div>
              <div className="pt-1 flex items-center gap-1.5 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Telegram MTProto Vault $0/mo</span>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-zinc-500">Connecting to vault...</div>
          )}
        </div>
      </aside>
    </>
  );
};
