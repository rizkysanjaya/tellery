/**
 * =============================================================================
 * Module: frontend/src/App.tsx
 * Purpose: Root application component managing gallery state, Silk Cloud Light/Dark
 *          neomorphic themes, Spotlight Command Palette (Ctrl+K), persistent left sidebar,
 *          multi-select system, virtual folders & icon/color customization, album favorites & rename,
 *          search, filtering, lightbox, drag-and-drop, context menus, Telegram vault uploads, and Telegram channel sync.
 * Used by: frontend/src/main.tsx
 * Dependencies: React, framer-motion, frontend/src/api.ts, frontend/src/types.ts, components, lucide-react
 * Public Members: App
 * Side Effects: Fetches timeline/folders/stats over HTTP, executes uploads, deletions,
 *                folder color & icon updates, favorites toggles, folder assignments, vault sync, and persists theme/layout in localStorage.
 * =============================================================================
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UploadCloud, ChevronLeft } from "lucide-react";
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
  triggerVaultSync,
  updateFolderColor,
  updateFolder,
  uploadMediaFile,
} from "./api";
import { FolderIcon } from "./components/ui/FolderIcon";
import { ContextMenu, ContextMenuPosition } from "./components/ContextMenu";
import { DuplicateConflictModal } from "./components/DuplicateConflictModal";
import { FolderGrid } from "./components/FolderGrid";
import { Header } from "./components/Header";
import { MediaLightbox } from "./components/MediaLightbox";
import { MoveConfirmationModal, MoveConflictItem } from "./components/MoveConfirmationModal";
import { SelectionToolbar } from "./components/SelectionToolbar";
import { Sidebar } from "./components/Sidebar";
import { TimelineGrid } from "./components/TimelineGrid";
import { UploadManager } from "./components/UploadManager";
import { AuroraBackground } from "./components/ui/AuroraBackground";
import { CommandPalette } from "./components/ui/CommandPalette";
import { UndoToast } from "./components/ui/UndoToast";
import { AppToast, ToastNotification, ToastType } from "./components/ui/AppToast";
import {
  ConflictResolutionAction,
  DisplayLayout,
  DuplicateConflict,
  FilterType,
  FolderItem,
  MainView,
  MediaItem,
  SortOption,
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
  const [displayLayout, setDisplayLayout] = useState<DisplayLayout>(() => {
    const saved = localStorage.getItem("telegallery_display_layout");
    return (saved as DisplayLayout) || "grid";
  });
  const [sortBy, setSortBy] = useState<SortOption>(() => {
    const saved = localStorage.getItem("telegallery_sort_by");
    return (saved as SortOption) || "date_desc";
  });
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("telegallery_theme");
    return (saved as "dark" | "light") || "dark";
  });

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("telegallery_theme", theme);
    } catch {
      // Ignore quota/storage errors
    }
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const [loading, setLoading] = useState(true);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  const handleDisplayLayoutChange = (layout: DisplayLayout) => {
    setDisplayLayout(layout);
    try {
      localStorage.setItem("telegallery_display_layout", layout);
    } catch {
      // Ignore quota/private browsing errors
    }
  };

  const handleSortChange = (newSort: SortOption) => {
    setSortBy(newSort);
    try {
      localStorage.setItem("telegallery_sort_by", newSort);
    } catch {
      // Ignore quota/private browsing errors
    }
  };

  // Mobile Sidebar Drawer State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

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

  // Folder Move Relocation Confirmation State
  const [pendingMove, setPendingMove] = useState<{
    targetFolderId: number;
    targetFolderName: string;
    mediaIds: number[];
    conflictedItems: MoveConflictItem[];
  } | null>(null);

  // Flat list of all media items in current view order
  const flatItems = useMemo(() => {
    return groups.flatMap((g) => g.items);
  }, [groups]);

  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  // Debounce ONLY text typing in search input (prevents lag on tab/album clicks)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  // Initial load for stats & folders
  useEffect(() => {
    fetchStats().then(setStats).catch(console.error);
    loadFolders();
  }, [loadFolders]);

  // Instant timeline loading on tab, filter, sort, or folder selection (0ms delay)
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const folderId = activeFolder ? activeFolder.id : null;
    fetchTimeline(0, 100, activeFilter, debouncedSearchQuery, folderId, sortBy)
      .then((res) => {
        if (isMounted) {
          setGroups(res.groups);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error(err);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeFilter, debouncedSearchQuery, activeFolder, sortBy]);

  const loadData = useCallback(() => {
    fetchStats().then(setStats).catch(console.error);
    loadFolders();
    setLoading(true);

    const folderId = activeFolder ? activeFolder.id : null;
    fetchTimeline(0, 100, activeFilter, debouncedSearchQuery, folderId, sortBy)
      .then((res) => {
        setGroups(res.groups);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [activeFilter, debouncedSearchQuery, activeFolder, sortBy, loadFolders]);

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncVault = useCallback(async (fullScan: boolean = false) => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await triggerVaultSync(fullScan);
      loadData();
    } catch (err) {
      console.error("Vault sync error:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, loadData]);

  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

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

    const targetFolder = folders.find((f) => f.id === folderId);
    const targetFolderName = targetFolder ? targetFolder.name : "Folder";

    // Check if any of the items already belong to a different folder
    const conflictedItems: MoveConflictItem[] = [];
    for (const id of ids) {
      const item = flatItems.find((m) => m.id === id);
      if (item && item.folder_id && item.folder_id !== folderId) {
        conflictedItems.push({
          id: item.id,
          fileName: item.file_name,
          currentFolderName: item.folder_name || "Folder",
        });
      }
    }

    if (conflictedItems.length > 0) {
      // Prompt user with Move Confirmation Modal
      setPendingMove({
        targetFolderId: folderId,
        targetFolderName,
        mediaIds: ids,
        conflictedItems,
      });
      return;
    }

    // No conflicts -> move immediately
    await addMediaToFolder(folderId, ids);
    loadData();
  };

  const handleConfirmPendingMove = async () => {
    if (!pendingMove) return;
    await addMediaToFolder(pendingMove.targetFolderId, pendingMove.mediaIds);
    setPendingMove(null);
    loadData();
  };

  const handleBulkCreateFolderAndAdd = async (name: string, mediaIds?: number[]) => {
    const created = await createFolder(name);
    const ids = mediaIds || Array.from(selectedIds);
    if (ids.length > 0) {
      // Use handleBulkAddToFolder to check for any existing folder conflicts
      await handleBulkAddToFolder(created.id, ids);
    } else {
      loadFolders();
    }
  };

  // 5-Second Undo Delete State
  const [pendingDeletion, setPendingDeletion] = useState<{
    items: MediaItem[];
    message: string;
  } | null>(null);
  const pendingDeletionRef = useRef<{
    items: MediaItem[];
    message: string;
  } | null>(null);
  const pendingDeletionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    pendingDeletionRef.current = pendingDeletion;
  }, [pendingDeletion]);

  const commitPendingDeletion = useCallback(async () => {
    if (pendingDeletionTimeoutRef.current) {
      clearTimeout(pendingDeletionTimeoutRef.current);
      pendingDeletionTimeoutRef.current = null;
    }
    const current = pendingDeletionRef.current;
    if (!current) return;
    const itemsToDelete = current.items;
    setPendingDeletion(null);
    pendingDeletionRef.current = null;

    // Perform permanent backend deletion asynchronously
    for (const item of itemsToDelete) {
      try {
        await deleteMediaItem(item.id);
      } catch (err) {
        console.error(`Failed to permanently delete media ${item.id}:`, err);
      }
    }
    // Refresh stats & folders
    fetchStats().then(setStats).catch(console.error);
    fetchFolders().then(setFolders).catch(console.error);
  }, []);

  const handleUndoDelete = useCallback(() => {
    if (pendingDeletionTimeoutRef.current) {
      clearTimeout(pendingDeletionTimeoutRef.current);
      pendingDeletionTimeoutRef.current = null;
    }
    const current = pendingDeletionRef.current;
    if (!current) return;

    // Restore items optimistically to timeline
    const restoredItems = current.items;
    setPendingDeletion(null);
    pendingDeletionRef.current = null;

    setGroups((prev) => {
      const next = [...prev];
      for (const item of restoredItems) {
        const dateKey = item.date_taken
          ? item.date_taken.split("T")[0]
          : "Unknown Date";
        const groupIndex = next.findIndex((g) => g.period_key === dateKey);
        if (groupIndex >= 0) {
          if (!next[groupIndex].items.some((i) => i.id === item.id)) {
            next[groupIndex] = {
              ...next[groupIndex],
              items: [item, ...next[groupIndex].items],
            };
          }
        } else {
          next.unshift({
            period_key: dateKey,
            period_title: dateKey,
            items: [item],
          });
        }
      }
      return next;
    });
  }, []);

  const queueDeleteItems = useCallback(
    (itemsToDelete: MediaItem[]) => {
      if (itemsToDelete.length === 0) return;

      // If a deletion was already pending, commit it immediately first
      if (pendingDeletionRef.current) {
        commitPendingDeletion();
      }

      const idsToDelete = new Set(itemsToDelete.map((i) => i.id));

      // Optimistic UI Removal: Remove items from current timeline view immediately
      setGroups((prev) =>
        prev
          .map((group) => ({
            ...group,
            items: group.items.filter((item) => !idsToDelete.has(item.id)),
          }))
          .filter((group) => group.items.length > 0)
      );

      // Deselect if selected
      setSelectedIds((prev) => {
        const next = new Set(prev);
        idsToDelete.forEach((id) => next.delete(id));
        return next;
      });

      // Close lightbox if current item is being deleted
      if (selectedMedia && idsToDelete.has(selectedMedia.id)) {
        setSelectedMedia(null);
      }

      const message =
        itemsToDelete.length === 1
          ? `Deleted "${itemsToDelete[0].file_name}"`
          : `Deleted ${itemsToDelete.length} items`;

      const newPending = {
        items: itemsToDelete,
        message,
      };
      setPendingDeletion(newPending);
      pendingDeletionRef.current = newPending;

      // Schedule 5-second automatic commit
      if (pendingDeletionTimeoutRef.current) {
        clearTimeout(pendingDeletionTimeoutRef.current);
      }
      pendingDeletionTimeoutRef.current = setTimeout(() => {
        commitPendingDeletion();
      }, 5000);
    },
    [commitPendingDeletion, selectedMedia]
  );

  const handleBulkDeleteSelected = async (mediaIds?: number[]) => {
    const ids = mediaIds || Array.from(selectedIds);
    const idSet = new Set(ids);
    const itemsToDelete = flatItems.filter((i) => idSet.has(i.id));
    if (itemsToDelete.length > 0) {
      queueDeleteItems(itemsToDelete);
    }
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
    const CONCURRENCY = 3; // Allow up to 3 simultaneous parallel file uploads

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
            (percent, loaded, _total, speedMbps) => {
              setUploadTasks((prev) =>
                prev.map((t) =>
                  t.id === task.id && t.status !== "completed" && t.status !== "duplicate"
                    ? {
                        ...t,
                        progress: percent,
                        loadedBytes: loaded,
                        speedMbps: speedMbps,
                        status: percent >= 100 ? "processing" : "uploading",
                      }
                    : t
                )
              );
            },
            () => {
              // Browser upload spooled; now actively uploading to Telegram Vault
              setUploadTasks((prev) =>
                prev.map((t) =>
                  t.id === task.id && t.status !== "completed" && t.status !== "duplicate"
                    ? { ...t, status: "uploading" }
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

  const handleCreateFolder = async (name: string, isCollection: boolean = false) => {
    const cleanName = name.trim();
    if (!cleanName) return;

    const exists = folders.some(
      (f) => f.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (exists) {
      showToast(`An album named "${cleanName}" already exists.`, "warning");
      return;
    }

    try {
      await createFolder(cleanName, null, isCollection);
      loadFolders();
      showToast(`${isCollection ? "Collection" : "Album"} "${cleanName}" created!`, "success");
    } catch (err: any) {
      showToast(err.message || `Failed to create ${isCollection ? "collection" : "album"}.`, "error");
    }
  };

  const handleMoveToCollection = async (folderId: number, collectionId: number | null) => {
    try {
      const updated = await updateFolder(folderId, { parent_id: collectionId });
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, parent_id: updated.parent_id } : f))
      );
      loadFolders();
      showToast(
        collectionId ? "Album moved to Collection" : "Album ungrouped from Collection",
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to move album to collection.", "error");
    }
  };

  const handleDeleteFolder = async (folderId: number) => {
    try {
      await deleteFolder(folderId);
      if (activeFolder && activeFolder.id === folderId) {
        setActiveFolder(null);
      }
      loadFolders();
      showToast("Album / Collection removed", "info");
    } catch (err: any) {
      showToast(err.message || "Failed to delete album.", "error");
    }
  };

  const handleUpdateFolderColor = async (folderId: number, color: string | null) => {
    try {
      const updated = await updateFolderColor(folderId, color);
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, color: updated.color } : f))
      );
      if (activeFolder && activeFolder.id === folderId) {
        setActiveFolder((prev) => (prev ? { ...prev, color: updated.color } : null));
      }
      showToast(color ? "Album color updated" : "Album color reset", "info");
    } catch (err: any) {
      showToast(err.message || "Failed to update album color.", "error");
    }
  };

  const handleRenameFolder = async (folderId: number, newName: string) => {
    try {
      const updated = await updateFolder(folderId, { name: newName });
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, name: updated.name } : f))
      );
      if (activeFolder && activeFolder.id === folderId) {
        setActiveFolder((prev) => (prev ? { ...prev, name: updated.name } : null));
      }
      showToast(`Album renamed to "${updated.name}"`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to rename album.", "error");
      throw err;
    }
  };

  const handleCustomizeFolder = async (folderId: number, color: string | null, icon: string) => {
    try {
      const updated = await updateFolder(folderId, { color, icon });
      setFolders((prev) =>
        prev.map((f) =>
          f.id === folderId ? { ...f, color: updated.color, icon: updated.icon } : f
        )
      );
      if (activeFolder && activeFolder.id === folderId) {
        setActiveFolder((prev) =>
          prev ? { ...prev, color: updated.color, icon: updated.icon } : null
        );
      }
      showToast("Album style updated!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to customize album.", "error");
      throw err;
    }
  };

  const handleToggleFavoriteFolder = async (folderId: number, isFavorite: boolean) => {
    try {
      const updated = await updateFolder(folderId, { is_favorite: isFavorite });
      setFolders((prev) =>
        prev.map((f) =>
          f.id === folderId ? { ...f, is_favorite: updated.is_favorite } : f
        )
      );
      if (activeFolder && activeFolder.id === folderId) {
        setActiveFolder((prev) =>
          prev ? { ...prev, is_favorite: updated.is_favorite } : null
        );
      }
      showToast(
        updated.is_favorite ? "Added to Favorites" : "Removed from Favorites",
        "info"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to update favorite status.", "error");
    }
  };

  const handleSetFolderCover = async (folderId: number, mediaId: number | null) => {
    try {
      const updated = await updateFolder(folderId, { cover_media_id: mediaId });
      setFolders((prev) =>
        prev.map((f) =>
          f.id === folderId
            ? {
                ...f,
                cover_media_id: updated.cover_media_id,
                cover_thumbnail_url: updated.cover_thumbnail_url,
              }
            : f
        )
      );
      if (activeFolder && activeFolder.id === folderId) {
        setActiveFolder((prev) =>
          prev
            ? {
                ...prev,
                cover_media_id: updated.cover_media_id,
                cover_thumbnail_url: updated.cover_thumbnail_url,
              }
            : null
        );
      }
      showToast(
        mediaId ? "Album cover thumbnail updated!" : "Album cover reset to latest added",
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to update cover thumbnail.", "error");
      throw err;
    }
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
    const item = flatItems.find((i) => i.id === id) || (selectedMedia?.id === id ? selectedMedia : null);
    if (item) {
      queueDeleteItems([item]);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    // If context menu is open, dismiss it
    if (contextMenu) {
      setContextMenu(null);
    }

    const target = e.target as HTMLElement;
    // Don't deselect if click originated from interactive controls or media cards
    if (
      target.closest(".media-card-item") ||
      target.closest(".folder-card-item") ||
      target.closest(".selection-toolbar") ||
      target.closest(".upload-manager") ||
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input") ||
      target.closest("dialog") ||
      target.closest("header") ||
      target.closest("aside")
    ) {
      return;
    }

    if (selectedIds.size > 0) {
      handleDeselectAll();
    }
  };

  return (
    <AuroraBackground>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={handleCanvasContextMenu}
        onClick={handleCanvasClick}
        className="min-h-screen text-zinc-100 flex relative"
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
        onRenameFolder={handleRenameFolder}
        onCustomizeFolder={handleCustomizeFolder}
        onSetFolderCover={handleSetFolderCover}
        onToggleFavoriteFolder={handleToggleFavoriteFolder}
        onMoveFolderToCollection={handleMoveToCollection}
        onAddMediaToFolder={handleBulkAddToFolder}
        onUpdateFolderColor={handleUpdateFolderColor}
        onTriggerUpload={() => hiddenFileInputRef.current?.click()}
        onSyncVault={handleSyncVault}
        isSyncing={isSyncing}
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
          displayLayout={displayLayout}
          onDisplayLayoutChange={handleDisplayLayoutChange}
          sortBy={sortBy}
          onSortChange={handleSortChange}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen((p) => !p)}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 pt-6">
          {/* Active Folder Breadcrumb Bar */}
          {activeFolder && (
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-outline-variant/15 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveFolder(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-base neo-button text-on-surface-variant hover:text-on-surface rounded-xl text-xs font-semibold transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>All Photos</span>
                </button>
                <div className="h-4 w-px bg-outline-variant/20" />
                <div className="flex items-center gap-2">
                  <FolderIcon
                    name={activeFolder.icon || "Folder"}
                    color={activeFolder.color || "var(--color-primary, #6366f1)"}
                    className="w-4 h-4"
                  />
                  <h2 className="text-lg font-bold text-on-surface">{activeFolder.name}</h2>
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
              onRenameFolder={handleRenameFolder}
              onCustomizeFolder={handleCustomizeFolder}
              onSetFolderCover={handleSetFolderCover}
              onToggleFavoriteFolder={handleToggleFavoriteFolder}
              onMoveFolderToCollection={handleMoveToCollection}
              onAddMediaToFolder={handleBulkAddToFolder}
              onUpdateFolderColor={handleUpdateFolderColor}
              loading={loadingFolders}
            />
          ) : (
            <TimelineGrid
              groups={groups}
              selectedIds={selectedIds}
              layout={displayLayout}
              sortBy={sortBy}
              onSortChange={handleSortChange}
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

      {/* Multi-Select Floating Toolbar Container (Flexbox centered between sidebar and right edge) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-7 left-0 right-0 md:left-64 pointer-events-none flex justify-center z-40 px-4">
          <SelectionToolbar
            selectedCount={selectedIds.size}
            folders={folders}
            onAddToFolder={(folderId) => handleBulkAddToFolder(folderId)}
            onCreateFolderAndAdd={(name) => handleBulkCreateFolderAndAdd(name)}
            onDeleteSelected={() => handleBulkDeleteSelected()}
            onDeselectAll={handleDeselectAll}
          />
        </div>
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
          prevItem={currentIndex > 0 ? flatItems[currentIndex - 1] : undefined}
          nextItem={currentIndex >= 0 && currentIndex < flatItems.length - 1 ? flatItems[currentIndex + 1] : undefined}
          onClose={() => setSelectedMedia(null)}
          onPrev={handlePrev}
          onNext={handleNext}
          hasPrev={currentIndex > 0}
          hasNext={currentIndex >= 0 && currentIndex < flatItems.length - 1}
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

      {/* Folder Move Relocation Confirmation Modal */}
      {pendingMove && (
        <MoveConfirmationModal
          targetFolderId={pendingMove.targetFolderId}
          targetFolderName={pendingMove.targetFolderName}
          conflictedItems={pendingMove.conflictedItems}
          totalSelectedCount={pendingMove.mediaIds.length}
          onConfirm={handleConfirmPendingMove}
          onCancel={() => setPendingMove(null)}
        />
      )}

      {/* 21st.dev Raycast / Spotlight Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        currentView={currentView}
        activeFolder={activeFolder}
        folders={folders}
        displayLayout={displayLayout}
        sortBy={sortBy}
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
        onDisplayLayoutChange={handleDisplayLayoutChange}
        onSortChange={handleSortChange}
        onTriggerUpload={() => hiddenFileInputRef.current?.click()}
        onSyncVault={handleSyncVault}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* 5-Second Undo Delete Toast */}
      <UndoToast
        isOpen={!!pendingDeletion}
        message={pendingDeletion?.message || ""}
        durationMs={5000}
        onUndo={handleUndoDelete}
        onCommit={commitPendingDeletion}
      />

      {/* Global In-App Notification Toasts */}
      <AppToast toasts={toasts} onDismiss={dismissToast} />
      </div>
    </AuroraBackground>
  );
};
