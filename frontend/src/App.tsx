/**
 * =============================================================================
 * Module: frontend/src/App.tsx
 * Purpose: Root application component managing gallery state, persistent left sidebar,
 *          multi-select system, virtual folders, search, filtering, lightbox, drag-and-drop,
 *          context menus, and Telegram vault uploads.
 * Used by: frontend/src/main.tsx
 * Dependencies: React, frontend/src/api.ts, frontend/src/types.ts, components, lucide-react
 * Public Members: App
 * Side Effects: Fetches timeline/folders/stats over HTTP, executes uploads, deletions, and folder assignments.
 * =============================================================================
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, UploadCloud, CheckCircle2, ChevronLeft, Folder } from "lucide-react";
import {
  addMediaToFolder,
  createFolder,
  deleteFolder,
  deleteMediaItem,
  fetchFolders,
  fetchStats,
  fetchTimeline,
  uploadMediaFile,
} from "./api";
import { ContextMenu, ContextMenuPosition } from "./components/ContextMenu";
import { FolderGrid } from "./components/FolderGrid";
import { Header } from "./components/Header";
import { MediaLightbox } from "./components/MediaLightbox";
import { SelectionToolbar } from "./components/SelectionToolbar";
import { Sidebar } from "./components/Sidebar";
import { TimelineGrid } from "./components/TimelineGrid";
import {
  FilterType,
  FolderItem,
  MainView,
  MediaItem,
  StatsResponse,
  TimelineGroup,
} from "./types";

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<MainView>("timeline");
  const [groups, setGroups] = useState<TimelineGroup[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [activeFolder, setActiveFolder] = useState<FolderItem | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  // Mobile Sidebar Drawer State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Multi-Select State
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);

  // Upload Progress State & Hidden File Input Ref
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);

  const loadFolders = useCallback(() => {
    setLoadingFolders(true);
    fetchFolders()
      .then((res) => {
        setFolders(res);
        setLoadingFolders(false);
      })
      .catch((err) => {
        console.error(err);
        setLoadingFolders(false);
      });
  }, []);

  const loadData = useCallback(() => {
    fetchStats().then(setStats).catch(console.error);
    loadFolders();
    setLoading(true);

    const folderId = activeFolder ? activeFolder.id : null;
    fetchTimeline(0, 100, activeFilter, searchQuery, folderId)
      .then((res) => {
        setGroups(res.groups);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [activeFilter, searchQuery, activeFolder, loadFolders]);

  // Load stats, folders, and timeline on filter/search/folder change
  useEffect(() => {
    const timeoutId = setTimeout(loadData, 150);
    return () => clearTimeout(timeoutId);
  }, [loadData]);

  // Escape key clears selection or closes context menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (contextMenu) {
          setContextMenu(null);
        } else if (selectedIds.size > 0 && !selectedMedia) {
          setSelectedIds(new Set());
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, selectedMedia, contextMenu]);

  // =========================================================================
  // Selection Handlers
  // =========================================================================

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllInGroup = (ids: number[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleDeselectAllInGroup = (ids: number[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const handleSelectAllGlobal = () => {
    const allIds = groups.flatMap((g) => g.items.map((i) => i.id));
    setSelectedIds(new Set(allIds));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  // =========================================================================
  // Bulk Action Handlers
  // =========================================================================

  const handleBulkAddToFolder = async (folderId: number, mediaIds?: number[]) => {
    const ids = mediaIds || Array.from(selectedIds);
    if (ids.length === 0) return;
    await addMediaToFolder(folderId, ids);
    loadFolders();
  };

  const handleBulkCreateFolderAndAdd = async (name: string, mediaIds?: number[]) => {
    const created = await createFolder(name);
    const ids = mediaIds || Array.from(selectedIds);
    if (ids.length > 0) {
      await addMediaToFolder(created.id, ids);
    }
    loadFolders();
  };

  const handleBulkDeleteSelected = async (mediaIds?: number[]) => {
    const ids = mediaIds || Array.from(selectedIds);
    for (const id of ids) {
      try {
        await deleteMediaItem(id);
      } catch (err) {
        console.error(`Failed to delete media ${id}:`, err);
      }
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    loadData();
  };

  // =========================================================================
  // Upload Handlers
  // =========================================================================

  const handleUploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsUploading(true);
    let uploaded = 0;
    const total = fileArray.length;

    for (let i = 0; i < total; i++) {
      const file = fileArray[i];
      setUploadStatus(`Uploading (${i + 1}/${total}) ${file.name}...`);
      try {
        await uploadMediaFile(file);
        uploaded++;
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
      }
    }

    setUploadStatus(`Uploaded ${uploaded} / ${total} files!`);
    setIsUploading(false);
    loadData();

    setTimeout(() => {
      setUploadStatus(null);
    }, 4000);
  };

  // =========================================================================
  // Folder CRUD Handlers
  // =========================================================================

  const handleCreateFolder = async (name: string) => {
    await createFolder(name);
    loadFolders();
  };

  const handleDeleteFolder = async (folderId: number) => {
    await deleteFolder(folderId);
    if (activeFolder && activeFolder.id === folderId) {
      setActiveFolder(null);
    }
    loadFolders();
  };

  // =========================================================================
  // Drag and Drop (File Upload) Handlers
  // =========================================================================

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  // =========================================================================
  // Context Menu Handlers
  // =========================================================================

  const handleCardContextMenu = (e: React.MouseEvent, item: MediaItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetItem: item,
    });
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".media-card-item")) {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        targetItem: null,
      });
    }
  };

  // =========================================================================
  // Lightbox Navigation
  // =========================================================================

  const flatItems = useMemo(() => {
    return groups.flatMap((g) => g.items);
  }, [groups]);

  const currentIndex = useMemo(() => {
    if (!selectedMedia) return -1;
    return flatItems.findIndex((item) => item.id === selectedMedia.id);
  }, [selectedMedia, flatItems]);

  const handlePrev = () => {
    if (currentIndex > 0) {
      setSelectedMedia(flatItems[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < flatItems.length - 1) {
      setSelectedMedia(flatItems[currentIndex + 1]);
    }
  };

  const handleDeleteMedia = async (id: number) => {
    try {
      await deleteMediaItem(id);
      setSelectedMedia(null);
      loadData();
    } catch (err) {
      console.error("Failed to delete media:", err);
      alert("Failed to delete media item from Telegram vault.");
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={handleCanvasContextMenu}
      className="min-h-screen bg-zinc-950 text-zinc-100 flex relative"
    >
      {/* Hidden File Input for Sidebar & Context Menu Upload trigger */}
      <input
        ref={hiddenFileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={(e) => {
          if (e.target.files) {
            handleUploadFiles(e.target.files);
          }
        }}
        className="hidden"
      />

      {/* Drag & Drop Upload Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-sky-950/80 backdrop-blur-md border-4 border-dashed border-sky-400 flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-200">
          <UploadCloud className="w-16 h-16 text-sky-400 mb-3 animate-pulse" />
          <h2 className="text-2xl font-bold text-white">Drop photos and videos here</h2>
          <p className="text-sm text-sky-200 mt-1">Files will be archived into your Telegram Vault</p>
        </div>
      )}

      {/* Persistent Left Sidebar */}
      <Sidebar
        currentView={currentView}
        activeFolder={activeFolder}
        folders={folders}
        stats={stats}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onSelectTimeline={() => {
          setCurrentView("timeline");
          setActiveFolder(null);
          setSelectedIds(new Set());
        }}
        onSelectAlbumsOverview={() => {
          setCurrentView("albums");
          setActiveFolder(null);
          setSelectedIds(new Set());
        }}
        onSelectFolder={(folder) => {
          setCurrentView("timeline");
          setActiveFolder(folder);
          setSelectedIds(new Set());
        }}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onAddMediaToFolder={handleBulkAddToFolder}
        onTriggerUpload={() => hiddenFileInputRef.current?.click()}
      />

      {/* Main Workspace Area (Offset by Sidebar on Desktop) */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0 min-h-screen">
        {/* Top Search & Filter Header */}
        <Header
          currentView={currentView}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen((p) => !p)}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 pt-6">
          {/* Active Folder Breadcrumb Bar */}
          {activeFolder && (
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-800 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveFolder(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold border border-zinc-800 transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>All Photos</span>
                </button>
                <div className="h-4 w-px bg-zinc-800" />
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-sky-400" />
                  <h2 className="text-lg font-bold text-white">{activeFolder.name}</h2>
                </div>
              </div>
            </div>
          )}

          {/* View Switcher: Albums Grid vs Timeline Grid */}
          {currentView === "albums" && !activeFolder ? (
            <FolderGrid
              folders={folders}
              onSelectFolder={(folder) => {
                setActiveFolder(folder);
                setCurrentView("timeline");
              }}
              onCreateFolder={handleCreateFolder}
              onDeleteFolder={handleDeleteFolder}
              onAddMediaToFolder={handleBulkAddToFolder}
              loading={loadingFolders}
            />
          ) : (
            <TimelineGrid
              groups={groups}
              selectedIds={selectedIds}
              onSelectMedia={setSelectedMedia}
              onToggleSelect={handleToggleSelect}
              onSelectAllInGroup={handleSelectAllInGroup}
              onDeselectAllInGroup={handleDeselectAllInGroup}
              onContextMenu={handleCardContextMenu}
              loading={loading}
            />
          )}
        </main>
      </div>

      {/* Multi-Select Floating Toolbar */}
      {selectedIds.size > 0 && (
        <SelectionToolbar
          selectedCount={selectedIds.size}
          folders={folders}
          onAddToFolder={(folderId) => handleBulkAddToFolder(folderId)}
          onCreateFolderAndAdd={(name) => handleBulkCreateFolderAndAdd(name)}
          onDeleteSelected={() => handleBulkDeleteSelected()}
          onDeselectAll={handleDeselectAll}
        />
      )}

      {/* Custom Context Menu */}
      {contextMenu && (
        <ContextMenu
          position={contextMenu}
          selectedIds={selectedIds}
          folders={folders}
          onClose={() => setContextMenu(null)}
          onOpenItem={(item) => setSelectedMedia(item)}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAllGlobal}
          onAddToFolder={handleBulkAddToFolder}
          onCreateFolderAndAdd={handleBulkCreateFolderAndAdd}
          onDeleteMedia={handleBulkDeleteSelected}
          onTriggerUpload={() => hiddenFileInputRef.current?.click()}
          onCreateFolder={handleCreateFolder}
        />
      )}

      {/* Floating Upload Progress Toast */}
      {uploadStatus && (
        <div className="fixed bottom-6 right-6 z-40 bg-zinc-900/95 border border-zinc-700/80 text-white px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
          {isUploading ? (
            <Loader2 className="w-5 h-5 text-sky-400 animate-spin" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          )}
          <span className="text-xs font-semibold">{uploadStatus}</span>
        </div>
      )}

      {/* Fullscreen Lightbox Modal */}
      {selectedMedia && (
        <MediaLightbox
          item={selectedMedia}
          allFolders={folders}
          onClose={() => setSelectedMedia(null)}
          onPrev={handlePrev}
          onNext={handleNext}
          hasPrev={currentIndex > 0}
          hasNext={currentIndex < flatItems.length - 1}
          onDelete={handleDeleteMedia}
        />
      )}
    </div>
  );
};
