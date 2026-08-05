/**
 * =============================================================================
 * Module: frontend/src/App.tsx
 * Purpose: Root application component managing gallery state, view switching (Timeline vs Albums),
 *          virtual folders, search, filtering, lightbox modal, drag-and-drop, and uploads.
 * Used by: frontend/src/main.tsx
 * Dependencies: React, frontend/src/api.ts, frontend/src/types.ts, components, lucide-react
 * Public Members: App
 * Side Effects: Fetches timeline items, folders, and stats over HTTP, executes uploads and deletions.
 * =============================================================================
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, UploadCloud, CheckCircle2, ChevronLeft, Folder } from "lucide-react";
import {
  createFolder,
  deleteFolder,
  deleteMediaItem,
  fetchFolders,
  fetchStats,
  fetchTimeline,
  uploadMediaFile,
} from "./api";
import { FolderGrid } from "./components/FolderGrid";
import { Header } from "./components/Header";
import { MediaLightbox } from "./components/MediaLightbox";
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

  // Upload Progress State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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

  // Handle uploading batch of files
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

  // Folder CRUD handlers
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

  // Drag and drop handlers
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

  // Flatten items for linear next/previous navigation in lightbox
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

  const handleViewChange = (view: MainView) => {
    setCurrentView(view);
    setActiveFolder(null);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col relative"
    >
      {/* Drag & Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-sky-950/80 backdrop-blur-md border-4 border-dashed border-sky-400 flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-200">
          <UploadCloud className="w-16 h-16 text-sky-400 mb-3 animate-bounce" />
          <h2 className="text-2xl font-bold text-white">Drop photos and videos here</h2>
          <p className="text-sm text-sky-200 mt-1">Files will be archived into your Telegram Vault</p>
        </div>
      )}

      {/* Top Header & Search Bar */}
      <Header
        currentView={currentView}
        onViewChange={handleViewChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        stats={stats}
        onUploadFiles={handleUploadFiles}
        isUploading={isUploading}
      />

      {/* Main Content Area */}
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
                <span>All Albums</span>
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
            onSelectFolder={(folder) => setActiveFolder(folder)}
            onCreateFolder={handleCreateFolder}
            onDeleteFolder={handleDeleteFolder}
            loading={loadingFolders}
          />
        ) : (
          <TimelineGrid
            groups={groups}
            onSelectMedia={setSelectedMedia}
            loading={loading}
          />
        )}
      </main>

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
