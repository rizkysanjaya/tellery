/**
 * =============================================================================
 * Module: frontend/src/App.tsx
 * Purpose: Root application component managing gallery state, search, filtering,
 *          lightbox modal, drag-and-drop ingestion, and file upload progress.
 * Used by: frontend/src/main.tsx
 * Dependencies: React, frontend/src/api.ts, frontend/src/types.ts, components, lucide-react
 * Public Members: App
 * Side Effects: Fetches timeline items and stats over HTTP, uploads multipart files to backend.
 * =============================================================================
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, UploadCloud, CheckCircle2 } from "lucide-react";
import { fetchStats, fetchTimeline, uploadMediaFile } from "./api";
import { Header } from "./components/Header";
import { MediaLightbox } from "./components/MediaLightbox";
import { TimelineGrid } from "./components/TimelineGrid";
import { FilterType, MediaItem, StatsResponse, TimelineGroup } from "./types";

export const App: React.FC = () => {
  const [groups, setGroups] = useState<TimelineGroup[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  // Upload Progress State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const loadData = useCallback(() => {
    fetchStats().then(setStats).catch(console.error);
    setLoading(true);
    fetchTimeline(0, 100, activeFilter, searchQuery)
      .then((res) => {
        setGroups(res.groups);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [activeFilter, searchQuery]);

  // Load stats and timeline on filter/search change
  useEffect(() => {
    const timeoutId = setTimeout(loadData, 200);
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
        <TimelineGrid
          groups={groups}
          onSelectMedia={setSelectedMedia}
          loading={loading}
        />
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
          onClose={() => setSelectedMedia(null)}
          onPrev={handlePrev}
          onNext={handleNext}
          hasPrev={currentIndex > 0}
          hasNext={currentIndex < flatItems.length - 1}
        />
      )}
    </div>
  );
};
