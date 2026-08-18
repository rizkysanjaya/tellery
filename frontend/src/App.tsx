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
import { UploadCloud, ChevronLeft, Folder } from "lucide-react";
import {
  addMediaToFolder,
  createFolder,
  createMediaAlias,
  deleteFolder,
  deleteMediaItem,
  fetchFolders,
  fetchStats,
  fetchTimeline,
  renameMediaItem,
  uploadMediaFile,
} from "./api";
import { ContextMenu, ContextMenuPosition } from "./components/ContextMenu";
import { DuplicateConflictModal } from "./components/DuplicateConflictModal";
import { FolderGrid } from "./components/FolderGrid";
import { Header } from "./components/Header";
import { MediaLightbox } from "./components/MediaLightbox";
import { SelectionToolbar } from "./components/SelectionToolbar";
import { Sidebar } from "./components/Sidebar";
import { TimelineGrid } from "./components/TimelineGrid";
import { UploadManager } from "./components/UploadManager";
import {
  ConflictResolutionAction,
  DuplicateConflict,
  FilterType,
  FolderItem,
  MainView,
  MediaItem,
  StatsResponse,
  TimelineGroup,
  UploadTask,
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

  // Multi-Select & Keyboard Anchor State
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);

  // Upload Tasks Queue State & Hidden File Input Ref
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const hiddenFileInputRef = useRef<HTMLInputElement>(null);

  // Duplicate Conflict Resolution State
  const [activeConflict, setActiveConflict] = useState<DuplicateConflict | null>(null);
  const conflictResolverRef = useRef<
    ((action: ConflictResolutionAction, customName?: string, applyToAll?: boolean) => void) | null
  >(null);
  const batchConflictPreferenceRef = useRef<{
    action: ConflictResolutionAction;
    customName?: string;
  } | null>(null);

  // Flat list of all media items in current view order
  const flatItems = useMemo(() => {
    return groups.flatMap((g) => g.items);
  }, [groups]);

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

  // Global Keyboard Shortcuts (Escape to clear/close, Ctrl+A / Cmd+A to select all)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in text inputs
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "Escape") {
        if (contextMenu) {
          setContextMenu(null);
        } else if (selectedIds.size > 0 && !selectedMedia) {
          setSelectedIds(new Set());
          setLastSelectedId(null);
        }
      }

      // Ctrl+A / Cmd+A -> Select All items
      if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
        if (!selectedMedia) {
          e.preventDefault();
          const allIds = flatItems.map((i) => i.id);
          setSelectedIds(new Set(allIds));
          setLastSelectedId(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, selectedMedia, contextMenu, flatItems]);

  // =========================================================================
  // Selection Handlers (with Shift+Click Google Drive-Style Range Selection)
  // =========================================================================

  const handleToggleSelect = (id: number, e?: React.MouseEvent) => {
    const isShift = e?.shiftKey;

    if (isShift && lastSelectedId !== null && flatItems.length > 0) {
      const anchorIdx = flatItems.findIndex((item) => item.id === lastSelectedId);
      const targetIdx = flatItems.findIndex((item) => item.id === id);

      if (anchorIdx !== -1 && targetIdx !== -1) {
        const start = Math.min(anchorIdx, targetIdx);
        const end = Math.max(anchorIdx, targetIdx);
        const rangeIds = flatItems.slice(start, end + 1).map((item) => item.id);

        setSelectedIds((prev) => {
          const next = new Set(prev);
          rangeIds.forEach((rangeId) => next.add(rangeId));
          return next;
        });
        setLastSelectedId(id);
        return;
      }
    }

    // Toggle individual item
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (lastSelectedId === id) {
          setLastSelectedId(null);
        }
      } else {
        next.add(id);
        setLastSelectedId(id);
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
    if (ids.length > 0) {
      setLastSelectedId(ids[ids.length - 1]);
    }
  };

  const handleDeselectAllInGroup = (ids: number[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const handleSelectAllGlobal = () => {
    const allIds = flatItems.map((i) => i.id);
    setSelectedIds(new Set(allIds));
    setLastSelectedId(null);
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
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

  const handleUploadFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    // Reset batch conflict preference for new upload batches
    batchConflictPreferenceRef.current = null;

    const newTasks: UploadTask[] = fileArray.map((f, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
      progress: 0,
      loadedBytes: 0,
      status: "pending",
    }));

    setUploadTasks((prev) => [...newTasks, ...prev]);

    // Process tasks concurrently with real-time byte tracking
    processUploadQueue(newTasks);
  };

  const processUploadQueue = async (tasksToProcess: UploadTask[]) => {
    const queue = [...tasksToProcess];
    const CONCURRENCY = 2; // Keep concurrency controlled during interactive conflicts

    const worker = async () => {
      while (queue.length > 0) {
        const task = queue.shift();
        if (!task) break;

        setUploadTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: "uploading" } : t))
        );

        try {
          const result = await uploadMediaFile(
            task.file,
            (percent, loaded) => {
              setUploadTasks((prev) =>
                prev.map((t) =>
                  t.id === task.id ? { ...t, progress: percent, loadedBytes: loaded } : t
                )
              );
            },
            () => {
              // Browser upload complete; now archiving & syncing to Telegram Vault
              setUploadTasks((prev) =>
                prev.map((t) =>
                  t.id === task.id
                    ? { ...t, status: "processing", progress: 95, loadedBytes: task.size }
                    : t
                )
              );
            }
          );

          if (result && result.status === "duplicate") {
            let chosenAction: ConflictResolutionAction = "skip";
            let chosenName: string | undefined = undefined;

            if (batchConflictPreferenceRef.current) {
              chosenAction = batchConflictPreferenceRef.current.action;
              chosenName = batchConflictPreferenceRef.current.customName;
            } else {
              // Pause and request user decision via Duplicate Conflict Dialog
              const userChoice = await new Promise<{
                action: ConflictResolutionAction;
                customName?: string;
                applyToAll?: boolean;
              }>((resolve) => {
                conflictResolverRef.current = (action, customName, applyToAll) => {
                  resolve({ action, customName, applyToAll });
                };
                setActiveConflict({
                  taskId: task.id,
                  fileName: task.name,
                  fileSize: task.size,
                  existingMediaId: result.media_id,
                  existingFileName: result.file_name,
                  existingCreatedAt: result.created_at,
                  existingFileSize: result.file_size,
                });
              });

              chosenAction = userChoice.action;
              chosenName = userChoice.customName;

              if (userChoice.applyToAll) {
                batchConflictPreferenceRef.current = {
                  action: userChoice.action,
                  customName: userChoice.customName,
                };
              }
            }

            // Execute chosen action
            if (chosenAction === "skip") {
              setUploadTasks((prev) =>
                prev.map((t) =>
                  t.id === task.id
                    ? {
                        ...t,
                        status: "duplicate",
                        progress: 100,
                        loadedBytes: task.size,
                        duplicateInfo: {
                          existingId: result.media_id,
                          existingFileName: result.file_name,
                          actionTaken: "skipped",
                        },
                      }
                    : t
                )
              );
            } else if (chosenAction === "keep_both") {
              const aliasName = chosenName || `${task.name} (1)`;
              await createMediaAlias(result.media_id, aliasName);
              setUploadTasks((prev) =>
                prev.map((t) =>
                  t.id === task.id
                    ? {
                        ...t,
                        name: aliasName,
                        status: "duplicate",
                        progress: 100,
                        loadedBytes: task.size,
                        duplicateInfo: {
                          existingId: result.media_id,
                          existingFileName: result.file_name,
                          actionTaken: "alias_created",
                        },
                      }
                    : t
                )
              );
              loadData();
            } else if (chosenAction === "rename_existing") {
              const renamedName = chosenName || task.name;
              await renameMediaItem(result.media_id, renamedName);
              setUploadTasks((prev) =>
                prev.map((t) =>
                  t.id === task.id
                    ? {
                        ...t,
                        name: renamedName,
                        status: "duplicate",
                        progress: 100,
                        loadedBytes: task.size,
                        duplicateInfo: {
                          existingId: result.media_id,
                          existingFileName: result.file_name,
                          actionTaken: "renamed_existing",
                        },
                      }
                    : t
                )
              );
              loadData();
            }
          } else {
            setUploadTasks((prev) =>
              prev.map((t) =>
                t.id === task.id
                  ? { ...t, status: "completed", progress: 100, loadedBytes: task.size }
                  : t
              )
            );
            loadData();
          }
        } catch (err: any) {
          console.error(`Upload error for ${task.name}:`, err);
          setUploadTasks((prev) =>
            prev.map((t) =>
              t.id === task.id
                ? { ...t, status: "error", errorMessage: err?.message || "Upload failed" }
                : t
            )
          );
        }
      }
    };

    // Run parallel workers concurrently
    const activeWorkers = Array.from(
      { length: Math.min(CONCURRENCY, tasksToProcess.length) },
      () => worker()
    );
    await Promise.all(activeWorkers);
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
    // Only show the upload overlay if the user is dragging real files from their computer OS,
    // and NOT an internal media card being dragged between folders/albums.
    const isInternalDrag = e.dataTransfer.types.includes("application/telegallery-media");
    const isExternalFiles = e.dataTransfer.types.includes("Files");

    if (isExternalFiles && !isInternalDrag) {
      e.preventDefault();
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Completely ignore internal media drags to prevent re-uploading thumbnails
    if (e.dataTransfer.types.includes("application/telegallery-media")) {
      return;
    }

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

      {/* Google Drive-Style Floating Upload Queue Manager */}
      <UploadManager
        tasks={uploadTasks}
        onDismiss={() => setUploadTasks([])}
        onClearCompleted={() => setUploadTasks((prev) => prev.filter((t) => t.status !== "completed"))}
      />

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

      {/* Interactive Duplicate Conflict Resolution Modal */}
      {activeConflict && (
        <DuplicateConflictModal
          conflict={activeConflict}
          onResolve={(action, customName, applyToAll) => {
            if (conflictResolverRef.current) {
              conflictResolverRef.current(action, customName, applyToAll);
            }
            setActiveConflict(null);
          }}
          onCancel={() => {
            if (conflictResolverRef.current) {
              conflictResolverRef.current("skip");
            }
            setActiveConflict(null);
          }}
        />
      )}
    </div>
  );
};
