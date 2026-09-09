/**
 * =============================================================================
 * Module: frontend/src/App.tsx
 * Purpose: Root application component managing gallery state, 100,000+ item keyset cursor
 *          pagination & infinite scroll, virtual windowing integration, VS Code-style 10-theme
 *          multi-theme system (Obsidian, Light, Matcha, Solar Flare, Tuscan, Tokyo,
 *          Abyss, Amethyst, Vapor Lime, Sakura), Battery Saver / Low Power GPU conservation mode,
 *          centralized Preferences & Storage dialog (SettingsModal),
 *          normalized WCAG 2.2 AA contrast in Light & Dark modes,
 *          Multi-Vault Telegram channel switching & dialog discovery,
 *          zero-config plug-and-play Silk Cloud dual-theme onboarding wizard & in-browser Telegram MTProto auth,
 *          on-demand Vault Strategy Hub (Step 5) modal overlay & hash-route invocation (#vault-setup),
 *          role permission gating (Read/Write for owned vaults vs. Read-Only for joined channels),
 *          partitioned sub-millisecond timeline queries, Spotlight Command Palette (Ctrl+K), persistent left sidebar,
 *          hash-based URL routing & state persistence (#/timeline, #/albums, #/albums/:id, #/favorites, #/trash),
 *          browser Back/Forward history navigation, deep linking across page refreshes (F5),
 *          dynamic code-splitting with React.lazy (<500 kB initial bundle size optimization),
 *          multi-select system, virtual folders & icon/color customization, single & bulk album/collection deletion,
 *          dedicated dual-section Favorites view (Favorite Albums + strictly filtered Favorite Media), individual media favoriting,
 *          Trash & Data Recovery system (safe soft-delete, 1-click restore, permanent delete, empty trash),
 *          batch ZIP archive downloads for multi-selected items, album ZIP exports,
 *          smart EXIF & metadata filtering (camera devices, orientation, resolution, calendar periods),
 *          chronological date-jump scrubber bar, full-window zero-flicker drag-and-drop global dropzone,
 *          deep recursive folder scanner (HTML5 FileSystem API) with batch deduplication and automatic album creation,
 *          search, lightbox, context-aware right-click menus, floating back-to-top button on noticeable scroll,
 *          media delete confirmation modals with 10-second undo countdown, Telegram vault uploads, and vault sync.
 * Used by: frontend/src/main.tsx
 * Dependencies: React (Suspense, lazy), framer-motion, frontend/src/api.ts, frontend/src/types.ts, components, lucide-react,
 *               frontend/src/utils/fileSystemScanner.ts, frontend/src/utils/navigation.ts, OnboardingWizard
 * Public Members: App
 * Side Effects: Fetches keyset-paginated timeline/folders/stats/trash/vaults/auth/filter-meta over HTTP, executes uploads,
 *                soft deletions, restorations, permanent purges, single/bulk folder deletions, ZIP exports/downloads,
 *                folder color & icon updates, favorites toggles, folder assignments, vault sync, updates browser
 *                window.location.hash history, handles MTProto auth session & disconnection, and persists theme/layout/batterySaver in localStorage.
 * =============================================================================
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Cloud, Loader2 } from "lucide-react";
import {
  addMediaToFolder,
  createFolder,
  createMediaAlias,
  deleteFolder,
  bulkDeleteFolders,
  deleteMediaItem,
  toggleFavoriteMedia,
  bulkToggleFavoriteMedia,
  fetchFolders,
  fetchStats,
  fetchTimeline,
  renameMediaItem,
  triggerVaultSync,
  updateFolderColor,
  updateFolder,
  uploadMediaFile,
  fetchTrashMedia,
  restoreMediaItem,
  bulkRestoreMedia,
  permanentDeleteMediaItem,
  emptyTrash,
  downloadBatchMediaZip,
  exportAlbumZip,
  fetchFilterMetadata,
  fetchVaults,
  fetchActiveVault,
  setActiveVault,
  fetchAuthStatus,
  logoutAccount,
} from "./api";
import { FolderIcon } from "./components/ui/FolderIcon";
import { ContextMenu, ContextMenuPosition } from "./components/ContextMenu";
import type { MoveConflictItem } from "./components/MoveConfirmationModal";
import { Header } from "./components/Header";
import { SelectionToolbar } from "./components/SelectionToolbar";
import { Sidebar } from "./components/Sidebar";
import { TimelineGrid } from "./components/TimelineGrid";
import { UploadManager } from "./components/UploadManager";
import { GlobalDropzone } from "./components/GlobalDropzone";
import { extractDroppedMedia, ScannedMediaItem } from "./utils/fileSystemScanner";
import { AuroraBackground } from "./components/ui/AuroraBackground";
import { CommandPalette } from "./components/ui/CommandPalette";
import { UndoToast } from "./components/ui/UndoToast";
import { AppToast, ToastNotification, ToastType } from "./components/ui/AppToast";
import { ThemeId, applyTheme, getSavedTheme, getThemeById } from "./config/themes";

// Dynamic code-splitting via React.lazy to reduce entry bundle size (<500 kB target)
const FolderGrid = React.lazy(() => import("./components/FolderGrid").then((m) => ({ default: m.FolderGrid })));
const FavoritesView = React.lazy(() => import("./components/FavoritesView").then((m) => ({ default: m.FavoritesView })));
const TrashView = React.lazy(() => import("./components/TrashView").then((m) => ({ default: m.TrashView })));
const MediaLightbox = React.lazy(() => import("./components/MediaLightbox").then((m) => ({ default: m.MediaLightbox })));
const ExifFilterDrawer = React.lazy(() => import("./components/ExifFilterDrawer").then((m) => ({ default: m.ExifFilterDrawer })));
const DuplicateConflictModal = React.lazy(() => import("./components/DuplicateConflictModal").then((m) => ({ default: m.DuplicateConflictModal })));
const MoveConfirmationModal = React.lazy(() => import("./components/MoveConfirmationModal").then((m) => ({ default: m.MoveConfirmationModal })));
const VaultSwitcherModal = React.lazy(() => import("./components/VaultSwitcherModal").then((m) => ({ default: m.VaultSwitcherModal })));
const SettingsModal = React.lazy(() => import("./components/SettingsModal").then((m) => ({ default: m.SettingsModal })));
const OnboardingWizard = React.lazy(() => import("./components/OnboardingWizard").then((m) => ({ default: m.OnboardingWizard })));
import { FolderCustomizeModal } from "./components/ui/FolderCustomizeModal";
import { FolderRenameModal } from "./components/ui/FolderRenameModal";
import { FolderCoverModal } from "./components/ui/FolderCoverModal";
import { FolderMoveModal } from "./components/ui/FolderMoveModal";
import { FolderDeleteConfirmModal } from "./components/ui/FolderDeleteConfirmModal";
import { MediaDeleteConfirmModal } from "./components/ui/MediaDeleteConfirmModal";
import { LogoutConfirmModal } from "./components/ui/LogoutConfirmModal";
import { DragDropDock } from "./components/ui/DragDropDock";
import { DragStackedPreview } from "./components/ui/DragStackedPreview";
import { BackToTopButton } from "./components/ui/BackToTopButton";
import {
  ActiveExifFilters,
  AuthStatusResponse,
  ConflictResolutionAction,
  DisplayLayout,
  DuplicateConflict,
  FilterMetadataResponse,
  FilterType,
  FolderItem,
  MainView,
  MediaItem,
  SortOption,
  StatsResponse,
  TimelineGroup,
  UploadTask,
  VaultItem,
} from "./types";
import { parseRouteFromHash, syncHashWithState } from "./utils/navigation";

export const App: React.FC = () => {
  const initialRoute = useMemo(() => parseRouteFromHash(window.location.hash), []);
  const [currentView, setCurrentView] = useState<MainView>(initialRoute.view);
  const pendingFolderIdRef = useRef<number | null>(initialRoute.folderId ?? null);
  const pendingCollectionIdRef = useRef<number | null>(initialRoute.collectionId ?? null);
  const [groups, setGroups] = useState<TimelineGroup[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const nextCursorRef = useRef<string | null>(null);
  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);
  const hasMoreRef = useRef<boolean>(false);
  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [activeFolder, setActiveFolder] = useState<FolderItem | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<FolderItem | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [vaults, setVaults] = useState<VaultItem[]>([]);
  const [activeVault, setActiveVaultState] = useState<VaultItem | null>(null);
  const [isVaultSwitcherOpen, setIsVaultSwitcherOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRefreshingVaults, setIsRefreshingVaults] = useState(false);
  const activeVaultRef = useRef<VaultItem | null>(null);
  useEffect(() => {
    activeVaultRef.current = activeVault;
  }, [activeVault]);

  // Telegram MTProto Authentication & Zero-Config Onboarding State
  const [authStatus, setAuthStatus] = useState<AuthStatusResponse | null>(null);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [showVaultSetupWizard, setShowVaultSetupWizard] = useState<boolean>(false);

  // Hash route listener for on-demand Step 5 Vault Setup access (#vault-setup, #step5)
  useEffect(() => {
    const handleHashCheck = () => {
      const h = window.location.hash.toLowerCase();
      if (h === "#vault-setup" || h === "#step5" || h === "#setup" || h === "#onboarding") {
        setShowVaultSetupWizard(true);
      }
    };
    handleHashCheck();
    window.addEventListener("hashchange", handleHashCheck);
    return () => window.removeEventListener("hashchange", handleHashCheck);
  }, []);

  useEffect(() => {
    fetchAuthStatus()
      .then((status) => {
        setAuthStatus(status);
      })
      .catch((err) => {
        console.error("Failed to check auth status:", err);
        setAuthStatus({
          has_credentials: true,
          is_authenticated: true,
          step: "ready",
          user: null,
          active_vault: null,
          phone: null,
        });
      })
      .finally(() => {
        setCheckingAuth(false);
      });
  }, []);
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
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => getSavedTheme());
  const activeThemeMeta = getThemeById(currentTheme);
  const theme: "dark" | "light" = activeThemeMeta.mode;

  const [batterySaver, setBatterySaver] = useState<boolean>(() => {
    const saved = localStorage.getItem("telegallery_battery_saver");
    if (saved !== null) {
      return saved === "true";
    }
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return true;
    }
    return false;
  });

  // Apply active theme tokens and mode class to document root
  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  // Persist battery saver mode and optionally auto-detect low battery (< 20%)
  useEffect(() => {
    try {
      localStorage.setItem("telegallery_battery_saver", String(batterySaver));
    } catch {
      // Ignore quota/storage errors
    }
  }, [batterySaver]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "getBattery" in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        if (!battery.charging && battery.level <= 0.20) {
          const saved = localStorage.getItem("telegallery_battery_saver");
          if (saved === null) {
            setBatterySaver(true);
          }
        }
      }).catch(() => {});
    }
  }, []);

  // Reactive state refs to eliminate stale closure problems across async callbacks & undo actions
  const activeFolderRef = useRef<FolderItem | null>(null);
  const activeFilterRef = useRef<FilterType>("all");
  const debouncedSearchQueryRef = useRef<string>("");
  const sortByRef = useRef<SortOption>("date_desc");
  const groupsRef = useRef<TimelineGroup[]>([]);
  const currentViewRef = useRef<MainView>("timeline");
  const foldersRef = useRef<FolderItem[]>([]);
  const dragCounterRef = useRef<number>(0);

  useEffect(() => {
    foldersRef.current = folders;
  }, [folders]);

  useEffect(() => {
    activeFolderRef.current = activeFolder;
  }, [activeFolder]);

  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

  useEffect(() => {
    sortByRef.current = sortBy;
  }, [sortBy]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  const selectedCollectionRef = useRef<FolderItem | null>(null);
  useEffect(() => {
    selectedCollectionRef.current = selectedCollection;
  }, [selectedCollection]);

  const handleToggleTheme = useCallback(() => {
    setCurrentTheme((prev) => {
      const meta = getThemeById(prev);
      return meta.mode === "dark" ? "light" : "obsidian";
    });
  }, []);

  const handleSelectTheme = useCallback((themeId: ThemeId) => {
    setCurrentTheme(themeId);
  }, []);

  const handleToggleBatterySaver = useCallback(() => {
    setBatterySaver((prev) => !prev);
  }, []);

  const [loading, setLoading] = useState(true);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  // Trash View State
  const [trashItems, setTrashItems] = useState<MediaItem[]>([]);
  const [trashTotal, setTrashTotal] = useState<number>(0);
  const [loadingTrash, setLoadingTrash] = useState(false);

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

  // Modals triggered via Context Menu or Direct Actions
  const [folderToCustomize, setFolderToCustomize] = useState<FolderItem | null>(null);
  const [folderToRename, setFolderToRename] = useState<FolderItem | null>(null);
  const [folderToCover, setFolderToCover] = useState<FolderItem | null>(null);
  const [folderToMove, setFolderToMove] = useState<FolderItem | null>(null);

  // Logout Confirmation Modal State
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Upload Tasks Queue State & Hidden File Input Ref
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const uploadTasksRef = useRef<UploadTask[]>([]);
  useEffect(() => {
    uploadTasksRef.current = uploadTasks;
  }, [uploadTasks]);
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

  useEffect(() => {
    debouncedSearchQueryRef.current = debouncedSearchQuery;
  }, [debouncedSearchQuery]);

  const loadFolders = useCallback((channelIdOverride?: number) => {
    setLoadingFolders(true);
    const targetChannel = channelIdOverride ?? activeVaultRef.current?.id;
    fetchFolders(targetChannel)
      .then((res) => {
        setFolders(res);
        setLoadingFolders(false);

        // Resolve pending deep link route from URL hash if present
        if (pendingFolderIdRef.current !== null) {
          const targetId = pendingFolderIdRef.current;
          pendingFolderIdRef.current = null;
          const found = res.find((f) => f.id === targetId);
          if (found) {
            setActiveFolder(found);
          } else {
            setCurrentView("albums");
            syncHashWithState("albums", null, null, true);
          }
        } else if (pendingCollectionIdRef.current !== null) {
          const targetColId = pendingCollectionIdRef.current;
          pendingCollectionIdRef.current = null;
          const foundCol = res.find((f) => f.id === targetColId);
          if (foundCol) {
            setSelectedCollection(foundCol);
          } else {
            setCurrentView("albums");
            syncHashWithState("albums", null, null, true);
          }
        }
      })
      .catch((err) => {
        console.error(err);
        setLoadingFolders(false);
      });
  }, []);

  const loadTrash = useCallback(async (channelIdOverride?: number) => {
    setLoadingTrash(true);
    try {
      const targetChannel = channelIdOverride ?? activeVaultRef.current?.id;
      const res = await fetchTrashMedia(100, 0, targetChannel);
      setTrashItems(res.items);
      setTrashTotal(res.total);
    } catch (err) {
      console.error("Failed to load trash items:", err);
    } finally {
      setLoadingTrash(false);
    }
  }, []);

  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Multi-Vault Telegram Dialog Discovery & Active Channel Switching
  const loadVaults = useCallback(async (refresh: boolean = false) => {
    try {
      if (refresh) setIsRefreshingVaults(true);
      const [vList, activeV] = await Promise.all([
        fetchVaults(refresh),
        fetchActiveVault().catch(() => null),
      ]);
      setVaults(vList);
      if (activeV) {
        setActiveVaultState(activeV);
      } else if (vList.length > 0) {
        const currentActive = vList.find((v) => v.is_active) || vList[0];
        setActiveVaultState(currentActive);
      }
    } catch (err) {
      console.error("Failed to load vaults:", err);
    } finally {
      if (refresh) setIsRefreshingVaults(false);
    }
  }, []);

  const handleSelectVault = useCallback(
    async (channelId: number) => {
      // 1. Immediately clear timeline, folders, and trash to ensure old channel items NEVER linger
      setGroups([]);
      setLoading(true);
      setActiveFolder(null);
      setSelectedMedia(null);
      setSelectedIds(new Set());
      setFolders([]);
      setTrashItems([]);
      setTrashTotal(0);

      // 2. Immediately update vaults array state so switcher modal & badges mark this channel as active
      setVaults((prev) =>
        prev.map((v) => ({
          ...v,
          is_active: v.id === channelId,
        }))
      );

      const matchingVault = vaults.find((v) => v.id === channelId);

      // 3. Immediately update active vault & synchronous ref
      if (matchingVault) {
        const optimisticVault: VaultItem = {
          ...matchingVault,
          is_active: true,
        };
        setActiveVaultState(optimisticVault);
        activeVaultRef.current = optimisticVault;

        // Optimistic stats update so sidebar immediately reflects the newly active vault
        setStats((prev) =>
          prev
            ? {
                ...prev,
                channel_name: matchingVault.title,
                channel_avatar_url: null,
                total_items: matchingVault.media_count,
                total_photos: 0,
                total_videos: 0,
                total_size_bytes: matchingVault.total_size_bytes,
              }
            : null
        );
      }

      try {
        const res = await setActiveVault(channelId);

        if (matchingVault) {
          const updatedActive: VaultItem = {
            ...matchingVault,
            role: res.role || matchingVault.role,
            can_upload: res.can_upload !== undefined ? res.can_upload : matchingVault.can_upload,
            can_delete: res.can_delete !== undefined ? res.can_delete : matchingVault.can_delete,
            is_active: true,
          };
          setActiveVaultState(updatedActive);
          activeVaultRef.current = updatedActive;
        } else {
          await loadVaults();
        }

        // Re-fetch channel-scoped telemetry, metadata, folders, and trash
        fetchStats(channelId).then(setStats).catch(console.error);
        fetchFilterMetadata(channelId).then(setFilterMetadata).catch(console.error);
        loadFolders(channelId);
        loadTrash(channelId);

        showToast(
          `Active vault switched to ${matchingVault?.title || channelId}.`,
          "success"
        );

        // 4. If newly selected vault has 0 items, trigger a quick auto-sync
        if (matchingVault && matchingVault.media_count === 0) {
          setIsSyncing(true);
          triggerVaultSync(channelId, false)
            .then(async (syncRes) => {
              const isFav = currentViewRef.current === "favorites";
              const refreshedTimeline = await fetchTimeline(
                0,
                100,
                activeFilterRef.current,
                debouncedSearchQueryRef.current,
                null,
                sortByRef.current,
                isFav,
                activeExifFiltersRef.current,
                channelId
              );
              setGroups(refreshedTimeline.groups);
              fetchStats(channelId).then(setStats).catch(console.error);
              if (syncRes.stats && syncRes.stats.added > 0) {
                showToast(`Found and indexed ${syncRes.stats.added} item(s) from ${matchingVault.title}.`, "success");
              }
            })
            .catch(console.error)
            .finally(() => setIsSyncing(false));
        }
      } catch (err: any) {
        console.error("Failed to switch vault:", err);
        showToast(err.message || "Failed to switch Telegram storage vault.", "error");
      }
    },
    [vaults, loadVaults, loadFolders, showToast]
  );

  // Smart EXIF & Date Filters State
  const [filterMetadata, setFilterMetadata] = useState<FilterMetadataResponse | null>(null);
  const [activeExifFilters, setActiveExifFilters] = useState<ActiveExifFilters>({});
  const activeExifFiltersRef = useRef<ActiveExifFilters>({});
  useEffect(() => {
    activeExifFiltersRef.current = activeExifFilters;
  }, [activeExifFilters]);
  const [isExifDrawerOpen, setIsExifDrawerOpen] = useState(false);

  const loadFilterMetadata = useCallback(() => {
    fetchFilterMetadata(activeVault?.id).then(setFilterMetadata).catch(console.error);
  }, [activeVault?.id]);

  // Initial load for vaults, stats, folders, filter metadata & trash count
  useEffect(() => {
    if (authStatus && authStatus.step !== "ready") return;
    loadVaults();
    fetchStats(activeVault?.id).then(setStats).catch(console.error);
    loadFolders(activeVault?.id);
    loadFilterMetadata();
    fetchTrashMedia(1, 0, activeVault?.id)
      .then((res) => setTrashTotal(res.total))
      .catch(console.error);
  }, [loadFolders, loadFilterMetadata, loadVaults, authStatus, activeVault?.id]);

  // Instant timeline loading on tab, filter, sort, EXIF filter, folder, or active vault selection (0ms delay)
  useEffect(() => {
    if (authStatus && authStatus.step !== "ready") return;
    if (currentView === "trash") {
      loadTrash();
      return;
    }

    let isMounted = true;
    setLoading(true);
    // Clear items immediately on active vault or filter switch to prevent lingering state
    setGroups([]);

    const folderId = activeFolder ? activeFolder.id : pendingFolderIdRef.current;
    const isFavoritesView = currentView === "favorites" && !activeFolder;
    fetchTimeline(
      0,
      100,
      activeFilter,
      debouncedSearchQuery,
      folderId,
      sortBy,
      isFavoritesView,
      activeExifFilters,
      activeVault?.id
    )
      .then((res) => {
        if (isMounted) {
          setGroups(res.groups);
          setNextCursor(res.next_cursor || null);
          setHasMore(!!res.has_more);
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
  }, [
    activeFilter,
    debouncedSearchQuery,
    activeFolder,
    sortBy,
    currentView,
    loadTrash,
    activeExifFilters,
    activeVault?.id,
  ]);

  // Synchronize browser URL hash when view, activeFolder, or selectedCollection changes in React state
  useEffect(() => {
    // If pending folder or collection deep link is still resolving, don't overwrite the hash
    if (pendingFolderIdRef.current !== null || pendingCollectionIdRef.current !== null) {
      return;
    }
    syncHashWithState(currentView, activeFolder, selectedCollection);
  }, [currentView, activeFolder, selectedCollection]);

  // Handle browser Back / Forward history navigation (hashchange event)
  const handleHashChange = useCallback(() => {
    const route = parseRouteFromHash(window.location.hash);

    const currentFId = activeFolderRef.current?.id ?? null;
    const targetFId = route.folderId ?? null;
    const currentColId = selectedCollectionRef.current?.id ?? null;
    const targetColId = route.collectionId ?? null;
    const currentV = currentViewRef.current;

    // Skip if state is already identical to parsed hash route
    if (currentV === route.view && currentFId === targetFId && currentColId === targetColId) {
      return;
    }

    if (route.folderId) {
      const folder = foldersRef.current.find((f) => f.id === route.folderId);
      if (folder) {
        setActiveFolder(folder);
        setSelectedCollection(null);
        setCurrentView("timeline");
      } else {
        pendingFolderIdRef.current = route.folderId;
        setCurrentView("timeline");
      }
    } else if (route.collectionId) {
      const col = foldersRef.current.find((f) => f.id === route.collectionId);
      if (col) {
        setActiveFolder(null);
        setSelectedCollection(col);
        setCurrentView("albums");
      } else {
        pendingCollectionIdRef.current = route.collectionId;
        setCurrentView("albums");
      }
    } else {
      setActiveFolder(null);
      setSelectedCollection(null);
      setCurrentView(route.view);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [handleHashChange]);

  const loadData = useCallback(() => {
    fetchStats().then(setStats).catch(console.error);
    loadFolders();
    loadFilterMetadata();
    setLoading(true);

    const currentFolder = activeFolderRef.current;
    const folderId = currentFolder ? currentFolder.id : null;
    const isFavoritesView = currentViewRef.current === "favorites" && !currentFolder;
    fetchTimeline(
      0,
      100,
      activeFilterRef.current,
      debouncedSearchQueryRef.current,
      folderId,
      sortByRef.current,
      isFavoritesView,
      activeExifFiltersRef.current,
      activeVaultRef.current?.id
    )
      .then((res) => {
        setGroups(res.groups);
        setNextCursor(res.next_cursor || null);
        setHasMore(!!res.has_more);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [loadFolders, loadFilterMetadata]);

  const loadDataRef = useRef(loadData);
  useEffect(() => {
    loadDataRef.current = loadData;
  }, [loadData]);

  // Keyset Cursor Infinite Scroll Pagination Handler for 100,000+ Scalability
  const handleLoadMore = useCallback(async () => {
    if (!hasMoreRef.current || isLoadingMore || !nextCursorRef.current) return;
    setIsLoadingMore(true);

    const currentFolder = activeFolderRef.current;
    const folderId = currentFolder ? currentFolder.id : null;
    const isFavoritesView = currentViewRef.current === "favorites" && !currentFolder;

    try {
      const res = await fetchTimeline(
        0,
        50,
        activeFilterRef.current,
        debouncedSearchQueryRef.current,
        folderId,
        sortByRef.current,
        isFavoritesView,
        activeExifFiltersRef.current,
        activeVaultRef.current?.id,
        nextCursorRef.current
      );

      if (res.groups && res.groups.length > 0) {
        setGroups((prev) => {
          const merged = [...prev];
          for (const newGroup of res.groups) {
            const existingGroupIndex = merged.findIndex((g) => g.period_key === newGroup.period_key);
            if (existingGroupIndex !== -1) {
              const existingGroup = merged[existingGroupIndex];
              const existingIds = new Set(existingGroup.items.map((i) => i.id));
              const freshItems = newGroup.items.filter((i) => !existingIds.has(i.id));
              merged[existingGroupIndex] = {
                ...existingGroup,
                items: [...existingGroup.items, ...freshItems],
                count: (existingGroup.count || existingGroup.items.length) + freshItems.length,
              };
            } else {
              merged.push(newGroup);
            }
          }
          return merged;
        });
      }

      setNextCursor(res.next_cursor || null);
      setHasMore(!!res.has_more);
    } catch (err) {
      console.error("Failed to load more media items:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore]);

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncVault = useCallback(async (fullScan: boolean = false) => {
    if (isSyncing) return;
    setIsSyncing(true);
    const targetChannelId = activeVaultRef.current?.id;
    try {
      const res = await triggerVaultSync(targetChannelId, fullScan);
      loadData();
      if (targetChannelId) {
        fetchStats(targetChannelId).then(setStats).catch(console.error);
      }
      showToast(res.message || "Vault synchronized successfully.", "success");
    } catch (err: any) {
      console.error("Vault sync error:", err);
      showToast(err.message || "Failed to synchronize vault.", "error");
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, loadData, showToast]);

  const handleRestoreItem = useCallback(async (mediaId: number) => {
    try {
      await restoreMediaItem(mediaId);
      setTrashItems((prev) => prev.filter((i) => i.id !== mediaId));
      setTrashTotal((prev) => Math.max(0, prev - 1));
      showToast("Media restored to gallery", "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to restore media", "error");
    }
  }, [showToast, loadData]);

  const handleBulkRestore = useCallback(async (mediaIds: number[]) => {
    try {
      await bulkRestoreMedia(mediaIds);
      const set = new Set(mediaIds);
      setTrashItems((prev) => prev.filter((i) => !set.has(i.id)));
      setTrashTotal((prev) => Math.max(0, prev - mediaIds.length));
      showToast(`Restored ${mediaIds.length} item(s) to gallery`, "success");
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to restore items", "error");
    }
  }, [showToast, loadData]);

  const handlePermanentDelete = useCallback(async (mediaId: number) => {
    try {
      await permanentDeleteMediaItem(mediaId);
      setTrashItems((prev) => prev.filter((i) => i.id !== mediaId));
      setTrashTotal((prev) => Math.max(0, prev - 1));
      showToast("Media permanently deleted from Telegram", "success");
      fetchStats(activeVaultRef.current?.id).then(setStats).catch(console.error);
    } catch (err: any) {
      showToast(err.message || "Failed to permanently delete media", "error");
    }
  }, [showToast]);

  const handleEmptyTrash = useCallback(async () => {
    try {
      const res = await emptyTrash(activeVaultRef.current?.id);
      setTrashItems([]);
      setTrashTotal(0);
      showToast(res.message || "Trash emptied successfully", "success");
      fetchStats(activeVaultRef.current?.id).then(setStats).catch(console.error);
    } catch (err: any) {
      showToast(err.message || "Failed to empty trash", "error");
    }
  }, [showToast]);

  const handleLogout = useCallback(() => {
    setIsLogoutModalOpen(true);
  }, []);

  const handleConfirmLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await logoutAccount();
      setAuthStatus({
        has_credentials: false,
        is_authenticated: false,
        step: "need_credentials",
        user: null,
        active_vault: null,
        phone: null,
      });
      setIsLogoutModalOpen(false);
      showToast("Telegram session disconnected successfully.", "info");
    } catch (err: any) {
      showToast(err.message || "Failed to disconnect Telegram session", "error");
    } finally {
      setIsLoggingOut(false);
    }
  }, [showToast]);

  const handleOnboardingComplete = useCallback(
    (status: AuthStatusResponse) => {
      setAuthStatus(status);
      loadVaults(true);
      loadData();
    },
    [loadVaults, loadData]
  );

  const [draggedMediaState, setDraggedMediaState] = useState<{
    isDragging: boolean;
    primaryItem: MediaItem | null;
    mediaIds: number[];
  }>({
    isDragging: false,
    primaryItem: null,
    mediaIds: [],
  });

  // Track global internal drag start & end for DragStackedPreview & DragDropDock
  useEffect(() => {
    const handleGlobalDragStart = (e: DragEvent) => {
      const cardEl = (e.target as HTMLElement)?.closest?.(".media-card-item");
      if (cardEl) {
        let ids: number[] = [];
        if (selectedIds.size > 0) {
          ids = Array.from(selectedIds);
        }

        const allItems = groups.flatMap((g) => g.items);
        const primary = ids.length > 0
          ? allItems.find((m) => m.id === ids[0]) || allItems[0] || null
          : allItems[0] || null;

        setDraggedMediaState({
          isDragging: true,
          primaryItem: primary,
          mediaIds: ids.length > 0 ? ids : primary ? [primary.id] : [],
        });
      }
    };

    const handleGlobalDragEnd = () => {
      setDraggedMediaState({
        isDragging: false,
        primaryItem: null,
        mediaIds: [],
      });
    };

    window.addEventListener("dragstart", handleGlobalDragStart);
    window.addEventListener("dragend", handleGlobalDragEnd);
    window.addEventListener("drop", handleGlobalDragEnd);

    return () => {
      window.removeEventListener("dragstart", handleGlobalDragStart);
      window.removeEventListener("dragend", handleGlobalDragEnd);
      window.removeEventListener("drop", handleGlobalDragEnd);
    };
  }, [groups, selectedIds]);

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
    const created = await createFolder(name, null, false, activeVaultRef.current?.id);
    const ids = mediaIds || Array.from(selectedIds);
    if (ids.length > 0) {
      // Use handleBulkAddToFolder to check for any existing folder conflicts
      await handleBulkAddToFolder(created.id, ids);
    } else {
      loadFolders();
    }
  };

  // 10-Second Undo Delete State & Confirmation Modal State
  const DELETE_UNDO_DURATION_MS = 10000;
  const [mediaToDelete, setMediaToDelete] = useState<MediaItem[] | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<{
    id: number;
    items: MediaItem[];
    message: string;
    previousGroups?: TimelineGroup[];
  } | null>(null);
  const pendingDeletionRef = useRef<{
    id: number;
    items: MediaItem[];
    message: string;
    previousGroups?: TimelineGroup[];
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

    // Perform backend soft-deletion (move to Trash) asynchronously
    for (const item of itemsToDelete) {
      try {
        await deleteMediaItem(item.id);
      } catch (err) {
        console.error(`Failed to move media to trash ${item.id}:`, err);
      }
    }
    // Refresh stats, folders, & trash total
    const currentChannel = activeVaultRef.current?.id;
    fetchStats(currentChannel).then(setStats).catch(console.error);
    loadFolders(currentChannel);
    fetchTrashMedia(1, 0, currentChannel)
      .then((res) => setTrashTotal(res.total))
      .catch(console.error);
  }, [loadFolders]);

  const handleUndoDelete = useCallback(() => {
    if (pendingDeletionTimeoutRef.current) {
      clearTimeout(pendingDeletionTimeoutRef.current);
      pendingDeletionTimeoutRef.current = null;
    }
    const current = pendingDeletionRef.current;
    if (!current) return;

    // Clear pending state
    const restoredItems = current.items;
    const previousSnapshot = current.previousGroups;
    setPendingDeletion(null);
    pendingDeletionRef.current = null;

    // 1. Instant 0ms Optimistic UI Restoration (for active album or timeline)
    if (previousSnapshot && previousSnapshot.length > 0) {
      setGroups(previousSnapshot.map((g) => ({ ...g, items: [...g.items] })));
    } else {
      // Fallback: restore items with accurate YYYY-MM group matching
      setGroups((prev) => {
        const next = prev.map((g) => ({ ...g, items: [...g.items] }));
        for (const item of restoredItems) {
          const rawDate = item.date_taken || item.created_at;
          const monthKey = rawDate ? rawDate.slice(0, 7) : "unknown";
          const dateObj = rawDate ? new Date(rawDate) : null;
          const periodTitle =
            dateObj && !isNaN(dateObj.getTime())
              ? dateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" })
              : "Unknown Date";

          const groupIndex = next.findIndex((g) => g.period_key === monthKey);
          if (groupIndex >= 0) {
            if (!next[groupIndex].items.some((i) => i.id === item.id)) {
              const updatedItems = [item, ...next[groupIndex].items];
              next[groupIndex] = {
                ...next[groupIndex],
                items: updatedItems,
                count: updatedItems.length,
                period: next[groupIndex].period || periodTitle,
                period_title: next[groupIndex].period_title || periodTitle,
              };
            }
          } else {
            next.unshift({
              period_key: monthKey,
              period_title: periodTitle,
              period: periodTitle,
              count: 1,
              items: [item],
            });
          }
        }
        return next;
      });
    }

    // 2. Synchronize current view (Timeline, Favorites, or Active Album) in background so no page refresh is ever needed
    const currentFolderId = activeFolderRef.current ? activeFolderRef.current.id : null;
    const isFavoritesView = currentViewRef.current === "favorites" && !activeFolderRef.current;
    fetchTimeline(
      0,
      100,
      activeFilterRef.current,
      debouncedSearchQueryRef.current,
      currentFolderId,
      sortByRef.current,
      isFavoritesView
    )
      .then((res) => {
        setGroups(res.groups);
      })
      .catch(console.error);

    // 3. Refresh album counts and storage stats
    const currentChannel = activeVaultRef.current?.id;
    loadFolders(currentChannel);
    fetchStats(currentChannel).then(setStats).catch(console.error);
  }, [loadFolders]);

  const queueDeleteItems = useCallback(
    (itemsToDelete: MediaItem[]) => {
      if (itemsToDelete.length === 0) return;

      // If a deletion was already pending, commit it immediately first
      if (pendingDeletionRef.current) {
        commitPendingDeletion();
      }

      const idsToDelete = new Set(itemsToDelete.map((i) => i.id));
      const previousGroupsSnapshot = groupsRef.current.map((g) => ({
        ...g,
        items: [...g.items],
      }));

      // Optimistic UI Removal: Remove items from current timeline / album view immediately
      setGroups((prev) =>
        prev
          .map((group) => {
            const remainingItems = group.items.filter((item) => !idsToDelete.has(item.id));
            return {
              ...group,
              count: remainingItems.length,
              items: remainingItems,
            };
          })
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
        id: Date.now(),
        items: itemsToDelete,
        message,
        previousGroups: previousGroupsSnapshot,
      };
      setPendingDeletion(newPending);
      pendingDeletionRef.current = newPending;

      // Schedule 10-second automatic commit
      if (pendingDeletionTimeoutRef.current) {
        clearTimeout(pendingDeletionTimeoutRef.current);
      }
      pendingDeletionTimeoutRef.current = setTimeout(() => {
        commitPendingDeletion();
      }, DELETE_UNDO_DURATION_MS);
    },
    [commitPendingDeletion, selectedMedia]
  );

  const handlePromptDeleteMedia = async (mediaIds?: number[]) => {
    if (activeVaultRef.current?.can_delete === false) {
      showToast("This connected channel is Read-Only. You do not have permission to delete media.", "error");
      return;
    }
    const ids = mediaIds || Array.from(selectedIds);
    const idSet = new Set(ids);
    const itemsToDelete = flatItems.filter((i) => idSet.has(i.id));
    if (itemsToDelete.length > 0) {
      setMediaToDelete(itemsToDelete);
    }
  };

  const handleConfirmMediaDelete = () => {
    if (mediaToDelete && mediaToDelete.length > 0) {
      queueDeleteItems(mediaToDelete);
    }
    setMediaToDelete(null);
  };

  const handleBulkDeleteSelected = async (mediaIds?: number[]) => {
    if (activeVaultRef.current?.can_delete === false) {
      showToast("This connected channel is Read-Only. You do not have permission to delete media.", "error");
      return;
    }
    const ids = mediaIds || Array.from(selectedIds);
    const idSet = new Set(ids);
    const itemsToDelete = flatItems.filter((i) => idSet.has(i.id));
    if (itemsToDelete.length > 0) {
      queueDeleteItems(itemsToDelete);
    }
  };

  const handleDownloadBatchSelected = async (mediaIds?: number[]) => {
    const ids = mediaIds || Array.from(selectedIds);
    if (ids.length === 0) return;
    showToast(`Preparing ZIP archive for ${ids.length} item${ids.length === 1 ? "" : "s"}...`, "info");
    try {
      await downloadBatchMediaZip(ids);
      showToast(`Downloaded ${ids.length} item${ids.length === 1 ? "" : "s"} as ZIP!`, "success");
    } catch (err: any) {
      showToast(`Download failed: ${err.message || "Unknown error"}`, "error");
    }
  };

  const handleExportAlbumZip = async (folder: FolderItem) => {
    showToast(`Preparing ZIP export for album "${folder.name}"...`, "info");
    try {
      await exportAlbumZip(folder.id);
      showToast(`Exported album "${folder.name}" as ZIP!`, "success");
    } catch (err: any) {
      showToast(`Export failed: ${err.message || "Unknown error"}`, "error");
    }
  };

  // =========================================================================
  // Upload Handlers
  // =========================================================================

  const handleUploadFiles = (
    files: FileList | File[],
    targetFolderId?: number | null,
    targetFolderName?: string
  ) => {
    if (activeVaultRef.current?.can_upload === false) {
      showToast("Active vault is Read-Only. Cannot upload media to connected channels.", "error");
      return;
    }
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    // Reset batch conflict preference for new upload batches
    batchConflictPreferenceRef.current = null;

    const assignedFolderId =
      targetFolderId !== undefined
        ? targetFolderId
        : activeFolderRef.current
        ? activeFolderRef.current.id
        : null;
    const assignedFolderName =
      targetFolderName !== undefined
        ? targetFolderName
        : activeFolderRef.current
        ? activeFolderRef.current.name
        : undefined;

    const newTasks: UploadTask[] = fileArray.map((f, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      file: f,
      name: f.name,
      size: f.size,
      type: f.type,
      progress: 0,
      loadedBytes: 0,
      status: "pending",
      folderId: assignedFolderId,
      folderName: assignedFolderName,
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
            },
            task.folderId
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
              loadDataRef.current();
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
              loadDataRef.current();
            }
          } else {
            setUploadTasks((prev) =>
              prev.map((t) =>
                t.id === task.id
                  ? { ...t, status: "completed", progress: 100, loadedBytes: task.size }
                  : t
              )
            );
            loadDataRef.current();
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

  const handleDroppedItems = async (scannedItems: ScannedMediaItem[]) => {
    if (!scannedItems || scannedItems.length === 0) return;

    if (activeVaultRef.current?.can_upload === false) {
      showToast("Active vault is Read-Only. Cannot upload media to connected channels.", "error");
      return;
    }

    // 1. Deduplicate incoming items within the batch by filename, size, and modified timestamp
    const seenInBatch = new Set<string>();
    const uniqueScanned: ScannedMediaItem[] = [];
    for (const item of scannedItems) {
      const key = `${item.file.name}__${item.file.size}__${item.file.lastModified}`;
      if (!seenInBatch.has(key)) {
        seenInBatch.add(key);
        uniqueScanned.push(item);
      }
    }

    // 2. Filter out items that are already being processed or queued in uploadTasks
    const activeTasks = uploadTasksRef.current || [];
    const activeKeys = new Set(
      activeTasks
        .filter((t) => t.status === "pending" || t.status === "uploading" || t.status === "processing")
        .map((t) => `${t.name}__${t.size}`)
    );
    const deduplicatedItems = uniqueScanned.filter(
      (item) => !activeKeys.has(`${item.file.name}__${item.file.size}`)
    );

    if (deduplicatedItems.length === 0) return;

    const currentActiveFolder = activeFolderRef.current;

    // Case A: User is currently viewing an Album
    if (currentActiveFolder) {
      // If the active container is a Collection, allow creating sub-albums under this collection
      if (currentActiveFolder.is_collection) {
        const distinctFolderNames = Array.from(
          new Set(
            deduplicatedItems
              .map((item) => item.rootFolderName)
              .filter((name): name is string => Boolean(name && name.trim()))
          )
        );

        const folderNameToItemMap = new Map<string, FolderItem>();
        let currentFolders = [...foldersRef.current];

        for (const folderName of distinctFolderNames) {
          const cleanName = folderName.trim();
          const existing = currentFolders.find(
            (f) =>
              f.parent_id === currentActiveFolder.id &&
              f.name.toLowerCase() === cleanName.toLowerCase()
          );
          if (existing) {
            folderNameToItemMap.set(folderName, existing);
          } else {
            try {
              const newFolder = await createFolder(cleanName, currentActiveFolder.id, false, activeVaultRef.current?.id);
              currentFolders = [newFolder, ...currentFolders];
              foldersRef.current = currentFolders;
              setFolders(currentFolders);
              folderNameToItemMap.set(folderName, newFolder);
            } catch (err) {
              console.error(`Failed to auto-create sub-album "${cleanName}":`, err);
            }
          }
        }

        const newTasks: UploadTask[] = deduplicatedItems.map((item, idx) => {
          let targetFolderId = currentActiveFolder.id;
          let targetFolderName = currentActiveFolder.name;

          if (item.rootFolderName && folderNameToItemMap.has(item.rootFolderName)) {
            const target = folderNameToItemMap.get(item.rootFolderName)!;
            targetFolderId = target.id;
            targetFolderName = target.name;
          }

          return {
            id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
            file: item.file,
            name: item.file.name,
            size: item.file.size,
            type: item.file.type,
            progress: 0,
            loadedBytes: 0,
            status: "pending",
            folderId: targetFolderId,
            folderName: targetFolderName,
          };
        });

        batchConflictPreferenceRef.current = null;
        setUploadTasks((prev) => [...newTasks, ...prev]);
        processUploadQueue(newTasks);
        return;
      }

      // Normal Album: User dropped files or a folder INTO this active album.
      // Every photo and video goes directly into this opened album!
      const newTasks: UploadTask[] = deduplicatedItems.map((item, idx) => ({
        id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        file: item.file,
        name: item.file.name,
        size: item.file.size,
        type: item.file.type,
        progress: 0,
        loadedBytes: 0,
        status: "pending",
        folderId: currentActiveFolder.id,
        folderName: currentActiveFolder.name,
      }));

      batchConflictPreferenceRef.current = null;
      setUploadTasks((prev) => [...newTasks, ...prev]);
      processUploadQueue(newTasks);
      return;
    }

    // Case B: User is in Timeline or Albums overview (activeFolder is null)
    // Dropped folders automatically become new root Albums!
    const distinctFolderNames = Array.from(
      new Set(
        deduplicatedItems
          .map((item) => item.rootFolderName)
          .filter((name): name is string => Boolean(name && name.trim()))
      )
    );

    const folderNameToItemMap = new Map<string, FolderItem>();
    let currentFolders = [...foldersRef.current];

    for (const folderName of distinctFolderNames) {
      const cleanName = folderName.trim();
      const existing = currentFolders.find(
        (f) => !f.parent_id && f.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (existing) {
        folderNameToItemMap.set(folderName, existing);
      } else {
        try {
          const newFolder = await createFolder(cleanName, null, false, activeVaultRef.current?.id);
          currentFolders = [newFolder, ...currentFolders];
          foldersRef.current = currentFolders;
          setFolders(currentFolders);
          folderNameToItemMap.set(folderName, newFolder);
        } catch (err) {
          console.error(`Failed to auto-create album for dropped folder "${cleanName}":`, err);
        }
      }
    }

    const newTasks: UploadTask[] = deduplicatedItems.map((item, idx) => {
      let targetFolderId: number | null = null;
      let targetFolderName: string | undefined = undefined;

      if (item.rootFolderName && folderNameToItemMap.has(item.rootFolderName)) {
        const target = folderNameToItemMap.get(item.rootFolderName)!;
        targetFolderId = target.id;
        targetFolderName = target.name;
      }

      return {
        id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        file: item.file,
        name: item.file.name,
        size: item.file.size,
        type: item.file.type,
        progress: 0,
        loadedBytes: 0,
        status: "pending",
        folderId: targetFolderId,
        folderName: targetFolderName,
      };
    });

    batchConflictPreferenceRef.current = null;
    setUploadTasks((prev) => [...newTasks, ...prev]);

    processUploadQueue(newTasks);
  };

  const handleDroppedItemsRef = useRef(handleDroppedItems);
  useEffect(() => {
    handleDroppedItemsRef.current = handleDroppedItems;
  }, [handleDroppedItems]);

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
      showToast(`A ${isCollection ? "collection" : "album"} named "${cleanName}" already exists.`, "warning");
      return;
    }

    try {
      await createFolder(cleanName, null, isCollection, activeVaultRef.current?.id);
      loadFolders();
      showToast(`${isCollection ? "Collection" : "Album"} "${cleanName}" created!`, "success");
    } catch (err: any) {
      showToast(err.message || `Failed to create ${isCollection ? "collection" : "album"}.`, "error");
    }
  };

  const handleMoveToCollection = async (folderId: number, collectionId: number | null) => {
    const target = folders.find((f) => f.id === folderId);
    const destCollection = collectionId ? folders.find((f) => f.id === collectionId) : null;
    try {
      const updated = await updateFolder(folderId, { parent_id: collectionId });
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, parent_id: updated.parent_id } : f))
      );
      loadFolders();
      showToast(
        destCollection
          ? `Album "${target?.name || ''}" moved to Collection "${destCollection.name}"`
          : `Album "${target?.name || ''}" ungrouped from Collection`,
        "success"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to move album to collection.", "error");
    }
  };

  const [foldersToDelete, setFoldersToDelete] = useState<FolderItem[]>([]);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);

  const handlePromptDeleteFolder = (folderOrFolders: FolderItem | FolderItem[] | number | number[]) => {
    if (Array.isArray(folderOrFolders)) {
      if (folderOrFolders.length === 0) return;
      if (typeof folderOrFolders[0] === "number") {
        const idSet = new Set(folderOrFolders as number[]);
        const found = folders.filter((f) => idSet.has(f.id));
        setFoldersToDelete(found);
      } else {
        setFoldersToDelete(folderOrFolders as FolderItem[]);
      }
    } else if (typeof folderOrFolders === "number") {
      const found = folders.find((f) => f.id === folderOrFolders);
      if (found) setFoldersToDelete([found]);
    } else {
      setFoldersToDelete([folderOrFolders]);
    }
  };

  const handleConfirmDeleteFolder = async () => {
    if (foldersToDelete.length === 0) return;
    setIsDeletingFolder(true);
    const targets = foldersToDelete;
    const targetIds = targets.map((f) => f.id);
    const count = targets.length;
    try {
      if (count === 1) {
        await deleteFolder(targets[0].id);
      } else {
        await bulkDeleteFolders(targetIds);
      }
      if (activeFolder && targetIds.includes(activeFolder.id)) {
        setActiveFolder(null);
      }
      setFoldersToDelete([]);
      loadFolders();
      const label =
        count === 1
          ? `${targets[0].is_collection ? "Collection" : "Album"} "${targets[0].name}" deleted`
          : `Deleted ${count} albums/collections`;
      showToast(label, "info");
    } catch (err: any) {
      showToast(err.message || "Failed to delete album(s).", "error");
    } finally {
      setIsDeletingFolder(false);
    }
  };

  const handleUpdateFolderColor = async (folderId: number, color: string | null) => {
    const target = folders.find((f) => f.id === folderId);
    const entityType = target?.is_collection ? "Collection" : "Album";
    try {
      const updated = await updateFolderColor(folderId, color);
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, color: updated.color } : f))
      );
      if (activeFolder && activeFolder.id === folderId) {
        setActiveFolder((prev) => (prev ? { ...prev, color: updated.color } : null));
      }
      showToast(color ? `${entityType} color updated` : `${entityType} color reset`, "info");
    } catch (err: any) {
      showToast(err.message || `Failed to update ${entityType.toLowerCase()} color.`, "error");
    }
  };

  const handleRenameFolder = async (folderId: number, newName: string) => {
    const target = folders.find((f) => f.id === folderId);
    const entityType = target?.is_collection ? "Collection" : "Album";
    try {
      const updated = await updateFolder(folderId, { name: newName });
      setFolders((prev) =>
        prev.map((f) => (f.id === folderId ? { ...f, name: updated.name } : f))
      );
      if (activeFolder && activeFolder.id === folderId) {
        setActiveFolder((prev) => (prev ? { ...prev, name: updated.name } : null));
      }
      showToast(`${entityType} renamed to "${updated.name}"`, "success");
    } catch (err: any) {
      showToast(err.message || `Failed to rename ${entityType.toLowerCase()}.`, "error");
      throw err;
    }
  };

  const handleCustomizeFolder = async (folderId: number, color: string | null, icon: string) => {
    const target = folders.find((f) => f.id === folderId);
    const entityType = target?.is_collection ? "Collection" : "Album";
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
      showToast(`${entityType} style updated!`, "success");
    } catch (err: any) {
      showToast(err.message || `Failed to customize ${entityType.toLowerCase()}.`, "error");
      throw err;
    }
  };

  const handleToggleFavoriteFolder = async (folderId: number, isFavorite: boolean) => {
    const target = folders.find((f) => f.id === folderId);
    const entityType = target?.is_collection ? "Collection" : "Album";
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
        updated.is_favorite ? `Added ${entityType.toLowerCase()} to Favorites` : `Removed ${entityType.toLowerCase()} from Favorites`,
        "info"
      );
    } catch (err: any) {
      showToast(err.message || "Failed to update favorite status.", "error");
    }
  };

  const handleToggleFavoriteMedia = async (mediaId: number, isFavorite: boolean) => {
    // Optimistic UI state update
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((item) =>
          item.id === mediaId ? { ...item, is_favorite: isFavorite } : item
        ),
      }))
    );
    if (selectedMedia && selectedMedia.id === mediaId) {
      setSelectedMedia((prev) => (prev ? { ...prev, is_favorite: isFavorite } : null));
    }

    try {
      await toggleFavoriteMedia(mediaId, isFavorite);
      showToast(
        isFavorite ? "Added to Favorites" : "Removed from Favorites",
        "info"
      );
      if (currentView === "favorites") {
        loadData();
      }
    } catch (err: any) {
      // Rollback
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          items: g.items.map((item) =>
            item.id === mediaId ? { ...item, is_favorite: !isFavorite } : item
          ),
        }))
      );
      showToast(err.message || "Failed to update favorite status.", "error");
    }
  };

  const handleBulkToggleFavoriteMedia = async (mediaIds: number[], isFavorite: boolean) => {
    if (mediaIds.length === 0) return;
    const targetSet = new Set(mediaIds);

    // Optimistic UI state update
    setGroups((prev) =>
      prev.map((g) => ({
        ...g,
        items: g.items.map((item) =>
          targetSet.has(item.id) ? { ...item, is_favorite: isFavorite } : item
        ),
      }))
    );

    try {
      await bulkToggleFavoriteMedia(mediaIds, isFavorite);
      showToast(
        isFavorite
          ? `Added ${mediaIds.length} ${mediaIds.length === 1 ? "item" : "items"} to Favorites`
          : `Removed ${mediaIds.length} ${mediaIds.length === 1 ? "item" : "items"} from Favorites`,
        "success"
      );
      if (currentView === "favorites") {
        loadData();
      }
    } catch (err: any) {
      loadData();
      showToast(err.message || "Failed to update bulk favorite status.", "error");
    }
  };

  const handleSetFolderCover = async (folderId: number, mediaId: number | null) => {
    const target = folders.find((f) => f.id === folderId);
    const entityType = target?.is_collection ? "Collection" : "Album";
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
        mediaId ? `${entityType} cover thumbnail updated!` : `${entityType} cover reset to latest added`,
        "success"
      );
    } catch (err: any) {
      showToast(err.message || `Failed to update ${entityType.toLowerCase()} cover.`, "error");
      throw err;
    }
  };

  // =========================================================================
  // Global Zero-Flicker Drag and Drop Handlers (Window Level)
  // =========================================================================

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      // Ignore internal drag-and-drop between folders/dock
      if (e.dataTransfer?.types.includes("application/telegallery-media")) {
        return;
      }
      if (!e.dataTransfer?.types.includes("Files")) {
        return;
      }
      e.preventDefault();
      dragCounterRef.current += 1;
      if (dragCounterRef.current === 1) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("application/telegallery-media")) {
        return;
      }
      if (!e.dataTransfer?.types.includes("Files")) {
        return;
      }
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("application/telegallery-media")) {
        return;
      }
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const handleDrop = async (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("application/telegallery-media")) {
        return;
      }
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        dragCounterRef.current = 0;
        setIsDragging(false);

        try {
          const scannedItems = await extractDroppedMedia(e.dataTransfer);
          if (scannedItems.length > 0) {
            handleDroppedItemsRef.current(scannedItems);
          }
        } catch (err) {
          console.error("Failed to process dropped files/folders:", err);
        }
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, []);

  // =========================================================================
  // Context Menu Handlers
  // =========================================================================

  const handleCardContextMenu = (e: React.MouseEvent, item: MediaItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetType: "media",
      targetItem: item,
    });
  };

  const handleFolderContextMenu = (e: React.MouseEvent, folder: FolderItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetType: "folder",
      targetFolder: folder,
    });
  };

  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".media-card-item") && !target.closest(".folder-card-item")) {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        targetType: "canvas",
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
    if (activeVaultRef.current?.can_delete === false) {
      showToast("This connected channel is Read-Only. You do not have permission to delete media.", "error");
      return;
    }
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

  const activeExifFilterCount = [
    activeExifFilters.camera,
    activeExifFilters.orientation,
    activeExifFilters.min_resolution,
    activeExifFilters.year,
    activeExifFilters.month,
  ].filter(Boolean).length;

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-on-surface">
        <div className="w-16 h-16 rounded-2xl bg-surface-container-low border border-outline-variant/20 flex items-center justify-center text-primary mb-4 animate-pulse shadow-xl">
          <Cloud className="w-8 h-8" />
        </div>
        <p className="text-sm text-on-surface-variant font-medium tracking-wide">Connecting to Tellery...</p>
      </div>
    );
  }

  if (authStatus && authStatus.step !== "ready") {
    return (
      <div className="min-h-screen bg-background text-on-surface relative">
        <Suspense
          fallback={
            <div className="min-h-screen bg-background flex items-center justify-center text-on-surface">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          }
        >
          <OnboardingWizard
            initialStatus={authStatus}
            onComplete={handleOnboardingComplete}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        </Suspense>
        <AppToast toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <AuroraBackground>
      <div
        onContextMenu={handleCanvasContextMenu}
        onClick={handleCanvasClick}
        className="min-h-screen text-on-surface bg-background flex relative selection:bg-primary/20 selection:text-primary"
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

      {/* Global Silk Cloud Drag & Drop Upload Overlay */}
      <GlobalDropzone
        isDragging={isDragging}
        activeFolderName={activeFolder?.name}
        readOnly={activeVault?.can_upload === false}
      />

      {/* Persistent Left Sidebar */}
      <Sidebar
        currentView={currentView}
        activeFolder={activeFolder}
        folders={folders}
        stats={stats}
        activeVault={activeVault}
        onOpenVaultSwitcher={() => setIsVaultSwitcherOpen(true)}
        canUpload={activeVault?.can_upload !== false}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onSelectTimeline={() => {
          setSearchQuery("");
          setCurrentView("timeline");
          setActiveFolder(null);
          setSelectedCollection(null);
          setSelectedIds(new Set());
        }}
        onSelectAlbumsOverview={() => {
          setSearchQuery("");
          setCurrentView("albums");
          setActiveFolder(null);
          setSelectedCollection(null);
          setSelectedIds(new Set());
        }}
        onSelectFavorites={() => {
          setSearchQuery("");
          setCurrentView("favorites");
          setActiveFolder(null);
          setSelectedCollection(null);
          setSelectedIds(new Set());
          setGroups((prev) =>
            prev
              .map((g) => ({
                ...g,
                items: g.items.filter((i) => Boolean(i.is_favorite)),
              }))
              .filter((g) => g.items.length > 0)
          );
        }}
        onSelectTrash={() => {
          setSearchQuery("");
          setCurrentView("trash");
          setActiveFolder(null);
          setSelectedCollection(null);
          setSelectedIds(new Set());
          loadTrash();
        }}
        trashCount={trashTotal}
        onSelectFolder={(folder) => {
          setSearchQuery("");
          setCurrentView("timeline");
          setActiveFolder(folder);
          setSelectedIds(new Set());
        }}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handlePromptDeleteFolder}
        onRenameFolder={handleRenameFolder}
        onCustomizeFolder={handleCustomizeFolder}
        onSetFolderCover={handleSetFolderCover}
        onToggleFavoriteFolder={handleToggleFavoriteFolder}
        onMoveFolderToCollection={handleMoveToCollection}
        onAddMediaToFolder={handleBulkAddToFolder}
        onTriggerUpload={() => {
          if (activeVault?.can_upload === false) {
            showToast("Active vault is Read-Only. Cannot upload media to connected channels.", "error");
            return;
          }
          hiddenFileInputRef.current?.click();
        }}
        onSyncVault={handleSyncVault}
        onExportFolderZip={handleExportAlbumZip}
        onFolderContextMenu={handleFolderContextMenu}
        isSyncing={isSyncing}
        onLogout={handleLogout}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Main Workspace Area (Offset by Sidebar on Desktop) */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0 min-h-screen">
        {/* Top Search & Filter Header */}
        <Header
          currentView={currentView}
          activeFolder={activeFolder}
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
          currentTheme={currentTheme}
          onToggleTheme={handleToggleTheme}
          batterySaver={batterySaver}
          onToggleBatterySaver={handleToggleBatterySaver}
          activeExifFilterCount={activeExifFilterCount}
          onOpenExifFilters={() => setIsExifDrawerOpen(true)}
        />

        {/* Active EXIF & Date Filters Pill Banner */}
        {activeExifFilterCount > 0 && (
          <div className="bg-surface-container-low border-b border-outline-variant/15 px-4 lg:px-8 py-2.5 flex items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-on-surface-variant font-medium">Active filters:</span>
              {activeExifFilters.camera && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary font-medium">
                  Camera: {activeExifFilters.camera}
                  <button
                    onClick={() => setActiveExifFilters((prev) => ({ ...prev, camera: null }))}
                    className="hover:text-primary-hover cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {activeExifFilters.orientation && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary font-medium capitalize">
                  {activeExifFilters.orientation}
                  <button
                    onClick={() => setActiveExifFilters((prev) => ({ ...prev, orientation: null }))}
                    className="hover:text-primary-hover cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {activeExifFilters.min_resolution && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary font-medium">
                  {activeExifFilters.min_resolution === "4k" ? "4K+ UHD" : "Full HD (1080p+)"}
                  <button
                    onClick={() => setActiveExifFilters((prev) => ({ ...prev, min_resolution: null }))}
                    className="hover:text-primary-hover cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {activeExifFilters.year && !activeExifFilters.month && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary font-medium">
                  Year: {activeExifFilters.year}
                  <button
                    onClick={() => setActiveExifFilters((prev) => ({ ...prev, year: null }))}
                    className="hover:text-primary-hover cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {activeExifFilters.month && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary font-medium">
                  Period: {activeExifFilters.month}
                  <button
                    onClick={() => setActiveExifFilters((prev) => ({ ...prev, month: null }))}
                    className="hover:text-primary-hover cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
            <button
              onClick={() => setActiveExifFilters({})}
              className="text-xs text-error hover:underline font-semibold shrink-0 cursor-pointer"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Main Content Viewport */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 pt-6">
          {/* Active Folder Breadcrumb Bar */}
          {activeFolder && (() => {
            const parentCollection = activeFolder.parent_id
              ? folders.find((f) => f.id === activeFolder.parent_id)
              : null;

            return (
              <div className="flex items-center justify-between mb-6 pb-3.5 border-b border-outline-variant/15 animate-in fade-in duration-200">
                <div className="flex items-center flex-wrap gap-2 text-sm">
                  {/* Far-left Back button */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFolder(null);
                      setSelectedCollection(parentCollection || null);
                      setCurrentView("albums");
                    }}
                    className="flex items-center gap-1 font-semibold text-primary hover:text-primary-hover hover:underline cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  {/* Parent Collection Trail (if inside a collection) */}
                  {parentCollection && (
                    <>
                      <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/40" />
                      <button
                        type="button"
                        onClick={() => {
                          setActiveFolder(null);
                          setSelectedCollection(parentCollection);
                          setCurrentView("albums");
                        }}
                        className="font-medium text-on-surface-variant hover:text-primary hover:underline cursor-pointer transition-colors"
                      >
                        {parentCollection.name}
                      </button>
                    </>
                  )}

                  <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/40" />

                  {/* Current Active Album */}
                  <div className="flex items-center gap-1.5 font-bold text-on-surface">
                    <FolderIcon
                      name={activeFolder.icon || "Folder"}
                      color={activeFolder.color || "var(--color-primary, #6366f1)"}
                      className="w-4 h-4"
                    />
                    <span>{activeFolder.name}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* View Switcher: Albums Grid vs Favorites View vs Timeline Grid */}
          {currentView === "albums" && !activeFolder ? (
            <Suspense fallback={null}>
              <FolderGrid
                folders={folders}
                selectedCollection={selectedCollection}
                onSelectCollection={setSelectedCollection}
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery("")}
                onSelectFolder={(folder) => {
                  setActiveFolder(folder);
                  setCurrentView("timeline");
                }}
                onCreateFolder={handleCreateFolder}
                onDeleteFolder={handlePromptDeleteFolder}
                onRenameFolder={handleRenameFolder}
                onCustomizeFolder={handleCustomizeFolder}
                onSetFolderCover={handleSetFolderCover}
                onToggleFavoriteFolder={handleToggleFavoriteFolder}
                onMoveFolderToCollection={handleMoveToCollection}
                onAddMediaToFolder={handleBulkAddToFolder}
                onUpdateFolderColor={handleUpdateFolderColor}
                onExportFolderZip={handleExportAlbumZip}
                onFolderContextMenu={handleFolderContextMenu}
                onCanvasContextMenu={handleCanvasContextMenu}
                loading={loadingFolders}
              />
            </Suspense>
          ) : currentView === "favorites" && !activeFolder ? (
            <Suspense fallback={null}>
              <FavoritesView
                favoriteFolders={folders.filter((f) => f.is_favorite)}
                mediaGroups={groups}
                selectedIds={selectedIds}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                displayLayout={displayLayout}
                onLayoutChange={handleDisplayLayoutChange}
                sortBy={sortBy}
                onSortChange={handleSortChange}
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery("")}
                onSelectMedia={setSelectedMedia}
                onToggleSelect={handleToggleSelect}
                onSelectAllInGroup={handleSelectAllInGroup}
                onDeselectAllInGroup={handleDeselectAllInGroup}
                onMediaContextMenu={handleCardContextMenu}
                onSelectFolder={(folder) => {
                  setActiveFolder(folder);
                  setCurrentView("timeline");
                }}
                onToggleFavoriteFolder={handleToggleFavoriteFolder}
                onToggleFavoriteMedia={handleToggleFavoriteMedia}
                onFolderContextMenu={handleFolderContextMenu}
                loading={loading}
                batterySaver={batterySaver}
              />
            </Suspense>
          ) : currentView === "trash" && !activeFolder ? (
            <Suspense fallback={null}>
              <TrashView
                items={trashItems}
                isLoading={loadingTrash}
                onRestoreItem={handleRestoreItem}
                onBulkRestore={handleBulkRestore}
                onPermanentDelete={handlePermanentDelete}
                onEmptyTrash={handleEmptyTrash}
                onRefresh={loadTrash}
              />
            </Suspense>
          ) : (
            <TimelineGrid
              groups={groups}
              selectedIds={selectedIds}
              searchQuery={searchQuery}
              onClearSearch={() => setSearchQuery("")}
              activeFolderName={activeFolder?.name}
              layout={displayLayout}
              sortBy={sortBy}
              onSortChange={handleSortChange}
              onSelectMedia={setSelectedMedia}
              onToggleSelect={handleToggleSelect}
              onSelectAllInGroup={handleSelectAllInGroup}
              onDeselectAllInGroup={handleDeselectAllInGroup}
              onContextMenu={handleCardContextMenu}
              onToggleFavorite={handleToggleFavoriteMedia}
              loading={loading}
              batterySaver={batterySaver}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
            />
          )}
        </main>
      </div>

      {/* Multi-Select Floating Toolbar Container (Flexbox centered between sidebar and right edge; fades out when dragging) */}
      <AnimatePresence>
        {selectedIds.size > 0 && !draggedMediaState.isDragging && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            className="fixed bottom-7 left-0 right-0 md:left-64 pointer-events-none flex justify-center z-40 px-4"
          >
            <SelectionToolbar
              selectedCount={selectedIds.size}
              folders={folders}
              onAddToFolder={(folderId) => handleBulkAddToFolder(folderId)}
              onCreateFolderAndAdd={(name) => handleBulkCreateFolderAndAdd(name)}
              onFavoriteSelected={() => handleBulkToggleFavoriteMedia(Array.from(selectedIds), true)}
              onDownloadSelected={() => handleDownloadBatchSelected()}
              onDeleteSelected={activeVault?.can_delete !== false ? () => handleBulkDeleteSelected() : undefined}
              onDeselectAll={handleDeselectAll}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Context Menu */}
      {contextMenu && (
        <ContextMenu
          position={contextMenu}
          currentView={currentView}
          activeFolder={activeFolder}
          selectedIds={selectedIds}
          folders={folders}
          onClose={() => setContextMenu(null)}
          onOpenItem={(item) => setSelectedMedia(item)}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAllGlobal}
          onAddToFolder={handleBulkAddToFolder}
          onCreateFolderAndAdd={handleBulkCreateFolderAndAdd}
          onDeleteMedia={activeVault?.can_delete !== false ? handlePromptDeleteMedia : undefined}
          onDownloadBatch={(mediaIds) => handleDownloadBatchSelected(mediaIds)}
          onTriggerUpload={() => {
            if (activeVault?.can_upload === false) {
              showToast("Active vault is Read-Only. Cannot upload media to connected channels.", "error");
              return;
            }
            hiddenFileInputRef.current?.click();
          }}
          onCreateFolder={handleCreateFolder}
          onSelectFolder={(folder) => {
            setActiveFolder(folder);
            setCurrentView("timeline");
          }}
          onRenameFolder={(folder) => setFolderToRename(folder)}
          onCustomizeFolder={(folder) => setFolderToCustomize(folder)}
          onSetFolderCover={(folder) => setFolderToCover(folder)}
          onOpenMoveModal={(folder) => setFolderToMove(folder)}
          onToggleFavoriteFolder={handleToggleFavoriteFolder}
          onToggleFavoriteMedia={handleToggleFavoriteMedia}
          onDeleteFolder={handlePromptDeleteFolder}
          onBackToOverview={() => {
            setActiveFolder(null);
            setCurrentView("albums");
          }}
          onRefreshData={loadData}
        />
      )}

      {/* Global Folder Modals (triggered via Context Menu or Direct Actions) */}
      {folderToCustomize && (
        <FolderCustomizeModal
          folder={folderToCustomize}
          isOpen={Boolean(folderToCustomize)}
          onClose={() => setFolderToCustomize(null)}
          onSave={handleCustomizeFolder}
        />
      )}

      {folderToRename && (
        <FolderRenameModal
          folder={folderToRename}
          isOpen={Boolean(folderToRename)}
          onClose={() => setFolderToRename(null)}
          onRename={handleRenameFolder}
        />
      )}

      {folderToCover && (
        <FolderCoverModal
          folder={folderToCover}
          isOpen={Boolean(folderToCover)}
          onClose={() => setFolderToCover(null)}
          onSaveCover={handleSetFolderCover}
        />
      )}

      {folderToMove && (
        <FolderMoveModal
          folder={folderToMove}
          collections={folders.filter((f) => f.is_collection)}
          isOpen={Boolean(folderToMove)}
          onClose={() => setFolderToMove(null)}
          onMove={handleMoveToCollection}
        />
      )}

      {/* Global Folder Delete Confirmation Dialog */}
      <FolderDeleteConfirmModal
        isOpen={foldersToDelete.length > 0}
        folders={foldersToDelete}
        onConfirm={handleConfirmDeleteFolder}
        onCancel={() => setFoldersToDelete([])}
        isDeleting={isDeletingFolder}
      />

      {/* Telegram Session Disconnect / Logout Confirmation Dialog */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onConfirm={handleConfirmLogout}
        onCancel={() => !isLoggingOut && setIsLogoutModalOpen(false)}
        isLoggingOut={isLoggingOut}
        accountName={stats?.account_name || authStatus?.user?.first_name || undefined}
        vaultTitle={activeVaultRef.current?.title || authStatus?.active_vault?.title}
      />

      {/* Google Drive-Style Floating Upload Queue Manager */}
      <UploadManager
        tasks={uploadTasks}
        onDismiss={() => setUploadTasks([])}
        onClearCompleted={() => setUploadTasks((prev) => prev.filter((t) => t.status !== "completed"))}
      />

      {/* Fullscreen Lightbox Modal */}
      {selectedMedia && (
        <Suspense fallback={null}>
          <MediaLightbox
            item={selectedMedia}
            prevItem={currentIndex > 0 ? flatItems[currentIndex - 1] : undefined}
            nextItem={currentIndex >= 0 && currentIndex < flatItems.length - 1 ? flatItems[currentIndex + 1] : undefined}
            onClose={() => setSelectedMedia(null)}
            onPrev={handlePrev}
            onNext={handleNext}
            hasPrev={currentIndex > 0}
            hasNext={currentIndex >= 0 && currentIndex < flatItems.length - 1}
            onToggleFavorite={handleToggleFavoriteMedia}
            onDelete={activeVault?.can_delete !== false ? handleDeleteMedia : undefined}
          />
        </Suspense>
      )}

      {/* Interactive Duplicate Conflict Resolution Modal */}
      {activeConflict && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* Folder Move Relocation Confirmation Modal */}
      {pendingMove && (
        <Suspense fallback={null}>
          <MoveConfirmationModal
            targetFolderId={pendingMove.targetFolderId}
            targetFolderName={pendingMove.targetFolderName}
            conflictedItems={pendingMove.conflictedItems}
            totalSelectedCount={pendingMove.mediaIds.length}
            onConfirm={handleConfirmPendingMove}
            onCancel={() => setPendingMove(null)}
          />
        </Suspense>
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
          setSearchQuery("");
          setCurrentView("timeline");
          setActiveFolder(null);
          setSelectedIds(new Set());
        }}
        onSelectAlbumsOverview={() => {
          setSearchQuery("");
          setCurrentView("albums");
          setActiveFolder(null);
          setSelectedIds(new Set());
        }}
        onSelectFavorites={() => {
          setSearchQuery("");
          setCurrentView("favorites");
          setActiveFolder(null);
          setSelectedIds(new Set());
          setGroups((prev) =>
            prev
              .map((g) => ({
                ...g,
                items: g.items.filter((i) => Boolean(i.is_favorite)),
              }))
              .filter((g) => g.items.length > 0)
          );
        }}
        onSelectFolder={(folder) => {
          setSearchQuery("");
          setCurrentView("timeline");
          setActiveFolder(folder);
          setSelectedIds(new Set());
        }}
        onDisplayLayoutChange={handleDisplayLayoutChange}
        onSortChange={handleSortChange}
        onTriggerUpload={() => hiddenFileInputRef.current?.click()}
        onSyncVault={handleSyncVault}
        theme={theme}
        currentTheme={currentTheme}
        onSelectTheme={handleSelectTheme}
        onToggleTheme={handleToggleTheme}
      />

      {/* Media Delete Confirmation Dialog */}
      <MediaDeleteConfirmModal
        isOpen={Boolean(mediaToDelete && mediaToDelete.length > 0)}
        items={mediaToDelete || []}
        onConfirm={handleConfirmMediaDelete}
        onCancel={() => setMediaToDelete(null)}
      />

      {/* Smart EXIF & Date Filters Popover Drawer */}
      <Suspense fallback={null}>
        <ExifFilterDrawer
          isOpen={isExifDrawerOpen}
          onClose={() => setIsExifDrawerOpen(false)}
          metadata={filterMetadata}
          activeFilters={activeExifFilters}
          onFilterChange={(newFilters) => setActiveExifFilters(newFilters)}
          onResetFilters={() => setActiveExifFilters({})}
        />
      </Suspense>

      {/* 10-Second Undo Delete Toast */}
      <UndoToast
        key={pendingDeletion?.id || "empty"}
        actionId={pendingDeletion?.id}
        isOpen={!!pendingDeletion}
        message={pendingDeletion?.message || ""}
        durationMs={DELETE_UNDO_DURATION_MS}
        onUndo={handleUndoDelete}
        onCommit={commitPendingDeletion}
      />

      {/* Stacked Card Deck Drag Preview with Counter Badge */}
      <DragStackedPreview
        isDragging={draggedMediaState.isDragging}
        draggedItem={draggedMediaState.primaryItem}
        draggedCount={draggedMediaState.mediaIds.length}
      />

      {/* Google Drive Style Bottom Fluid Action Drop Dock */}
      <DragDropDock
        isVisible={draggedMediaState.isDragging && draggedMediaState.mediaIds.length > 0}
        folders={folders}
        draggedMediaIds={draggedMediaState.mediaIds}
        onDropTrash={(ids) => {
          if (activeVault?.can_delete === false) {
            showToast("This connected channel is Read-Only. You do not have permission to delete media.", "error");
            return;
          }
          const allItems = groups.flatMap((g) => g.items);
          const itemsToDelete = allItems.filter((i) => ids.includes(i.id));
          if (itemsToDelete.length > 0) {
            setMediaToDelete(itemsToDelete);
          }
        }}
        onDropAlbum={(folderId, ids) => {
          handleBulkAddToFolder(folderId, ids);
        }}
        onDropFavorite={async (ids) => {
          await handleBulkToggleFavoriteMedia(ids, true);
        }}
        onDropDeselect={() => {
          setSelectedIds(new Set());
          setLastSelectedId(null);
        }}
      />

      {/* Telegram Multi-Vault Switcher Modal */}
      <Suspense fallback={null}>
        {isVaultSwitcherOpen && (
          <VaultSwitcherModal
            isOpen={isVaultSwitcherOpen}
            onClose={() => setIsVaultSwitcherOpen(false)}
            vaults={vaults}
            activeVault={activeVault}
            onSelectVault={handleSelectVault}
            onRefreshVaults={() => loadVaults(true)}
            onOpenVaultSetup={() => setShowVaultSetupWizard(true)}
            isRefreshing={isRefreshingVaults}
          />
        )}
      </Suspense>

      {/* Centralized Preferences & Storage Settings Modal */}
      <Suspense fallback={null}>
        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            stats={stats}
            activeVault={activeVault}
            theme={theme}
            currentTheme={currentTheme}
            onSelectTheme={handleSelectTheme}
            onToggleTheme={handleToggleTheme}
            batterySaver={batterySaver}
            onToggleBatterySaver={handleToggleBatterySaver}
            onLogout={handleLogout}
            onOpenVaultSwitcher={() => setIsVaultSwitcherOpen(true)}
          />
        )}
      </Suspense>

      {/* On-Demand Welcome & Vault Strategy Hub (Step 5 Modal / Overlay) */}
      <Suspense fallback={null}>
        {showVaultSetupWizard && authStatus && (
          <OnboardingWizard
            initialStatus={authStatus}
            initialStep="need_vault"
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onComplete={(newStatus) => {
              setShowVaultSetupWizard(false);
              window.location.hash = "";
              handleOnboardingComplete(newStatus);
            }}
            onDismiss={() => {
              setShowVaultSetupWizard(false);
              window.location.hash = "";
            }}
          />
        )}
      </Suspense>

      {/* Floating Dev Mode Action: Instant Step 5 Access */}
      <div className="fixed bottom-4 left-4 z-40">
        <button
          type="button"
          onClick={() => setShowVaultSetupWizard(true)}
          className="px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/30 text-xs font-semibold shadow-lg backdrop-blur-md flex items-center gap-2 transition-all group cursor-pointer hover:scale-105 active:scale-95"
          title="Open Step 5 (Welcome & Vault Strategy Hub) without logging out or needing OTP"
        >
          <span className="w-2 h-2 rounded-full bg-primary group-hover:scale-125 transition-transform" />
          <span>Step 5: Vault Setup</span>
        </button>
      </div>

      {/* Global In-App Notification Toasts */}
      <AppToast toasts={toasts} onDismiss={dismissToast} />

      {/* Floating Back to Top Button (Noticeable Scroll) */}
      <BackToTopButton threshold={450} />
      </div>
    </AuroraBackground>
  );
};
