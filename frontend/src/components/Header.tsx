/**
 * =============================================================================
 * Module: frontend/src/components/Header.tsx
 * Purpose: Pro-grade flat obsidian top navigation header with hairline borders,
 *          precision spotlight search, segmented filter pills, smart EXIF & date filter trigger,
 *          sort popover menu, universal theme toggle, battery saver toggle, and layout switchers.
 * Used by: frontend/src/App.tsx
 * Dependencies: lucide-react, frontend/src/types.ts, frontend/src/config/themes.ts, AnimatedTabs
 * Public Members: Header
 * Side Effects: Dispatches search, filter, EXIF drawer toggle, sort, theme, battery saver, and layout change events.
 * =============================================================================
 */

import React, { useState, useRef, useEffect } from "react";
import {
  Search,
  Image as ImageIcon,
  Video,
  Layers,
  Menu,
  LayoutGrid,
  Grid3X3,
  Columns3,
  List,
  ArrowUpDown,
  Check,
  ChevronDown,
  X,
  Command,
  Sun,
  Moon,
  SlidersHorizontal,
  Zap,
  ZapOff,
} from "lucide-react";
import { DisplayLayout, FilterType, FolderItem, MainView, SortOption } from "../types";
import { ThemeId, getThemeById } from "../config/themes";
import { AnimatedTabs, TabItem } from "./ui/AnimatedTabs";

interface HeaderProps {
  currentView: MainView;
  activeFolder?: FolderItem | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: FilterType;
  onFilterChange: (f: FilterType) => void;
  displayLayout?: DisplayLayout;
  onDisplayLayoutChange?: (l: DisplayLayout) => void;
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  onOpenCommandPalette?: () => void;
  onToggleMobileSidebar: () => void;
  theme?: "dark" | "light";
  currentTheme?: ThemeId;
  onToggleTheme?: () => void;
  batterySaver?: boolean;
  onToggleBatterySaver?: () => void;
  activeExifFilterCount?: number;
  onOpenExifFilters?: () => void;
}

const SORT_LABELS: Record<SortOption, { label: string; group: string }> = {
  date_desc: { label: "Newest First", group: "Date" },
  date_asc: { label: "Oldest First", group: "Date" },
  name_asc: { label: "Name (A → Z)", group: "Name" },
  name_desc: { label: "Name (Z → A)", group: "Name" },
  size_desc: { label: "Size (Largest)", group: "Size" },
  size_asc: { label: "Size (Smallest)", group: "Size" },
};

export const Header: React.FC<HeaderProps> = ({
  currentView,
  activeFolder,
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  displayLayout = "grid",
  onDisplayLayoutChange,
  sortBy = "date_desc",
  onSortChange,
  onOpenCommandPalette,
  onToggleMobileSidebar,
  theme = "dark",
  currentTheme = "obsidian",
  onToggleTheme,
  batterySaver = false,
  onToggleBatterySaver,
  activeExifFilterCount = 0,
  onOpenExifFilters,
}) => {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isAlbumsOverview = currentView === "albums" && !activeFolder;
  const isFavoritesOverview = currentView === "favorites" && !activeFolder;
  const searchPlaceholder = isAlbumsOverview
    ? "Search albums & collections..."
    : isFavoritesOverview
    ? "Search in favorites..."
    : activeFolder
    ? `Search in "${activeFolder.name}"...`
    : "Search photos, videos, tags...";

  // Global Ctrl+K / Cmd+K search focus or command palette shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (onOpenCommandPalette) {
          onOpenCommandPalette();
        } else {
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenCommandPalette]);

  // Close sort menu on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        sortMenuRef.current &&
        !sortMenuRef.current.contains(e.target as Node)
      ) {
        setShowSortMenu(false);
      }
    };

    if (showSortMenu) {
      document.addEventListener("mousedown", handleMouseDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [showSortMenu]);

  const filterTabs: TabItem<FilterType>[] = [
    { id: "all", label: "All", icon: <Layers className="w-4 h-4" /> },
    { id: "photo", label: "Photos", icon: <ImageIcon className="w-4 h-4" /> },
    { id: "video", label: "Videos", icon: <Video className="w-4 h-4" /> },
  ];

  const layoutTabs: TabItem<DisplayLayout>[] = [
    { id: "grid", label: "Grid View", icon: <LayoutGrid className="w-4 h-4" /> },
    { id: "dense", label: "Dense View", icon: <Grid3X3 className="w-4 h-4" /> },
    { id: "masonry", label: "Natural Aspect", icon: <Columns3 className="w-4 h-4" /> },
    { id: "list", label: "Detailed List", icon: <List className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-outline-variant/15 px-4 lg:px-6 py-2.5 transition-all">
      <div className="flex items-center justify-between gap-3 sm:gap-4">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={onToggleMobileSidebar}
          className="p-1.5 -ml-1 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] rounded-lg md:hidden cursor-pointer transition-colors w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0 touch-manipulation"
          title="Open Navigation"
          aria-label="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Spotlight Search Input */}
        <div className="relative flex-1 min-w-[140px] sm:min-w-[180px] md:min-w-[220px] max-w-md group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant/70 group-focus-within:text-primary transition-colors z-10" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-12 sm:pr-16 py-1.5 bg-surface-container-lowest/70 border border-outline-variant/15 rounded-lg text-xs font-medium text-on-surface placeholder-on-surface-variant/50 outline-none transition-all focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
          />

          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
            {searchQuery ? (
              <button
                onClick={() => onSearchChange("")}
                className="p-1 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06] rounded transition-colors cursor-pointer flex items-center justify-center touch-manipulation"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onOpenCommandPalette}
                className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant/15 text-[10px] font-mono font-medium text-on-surface-variant hover:text-on-surface hover:border-outline-variant/30 cursor-pointer select-none transition-colors"
                title="Open Command Palette (Ctrl+K)"
              >
                <Command className="w-3 h-3" />K
              </button>
            )}
          </div>
        </div>

        {/* Controls: Filter Pills, Sort Dropdown & Layout Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {currentView === "timeline" && (
            <>
              {/* Filter Pills (All / Photos / Videos) with responsive text collapsing */}
              <AnimatedTabs<FilterType>
                tabs={filterTabs}
                activeId={activeFilter}
                onChange={onFilterChange}
                layoutIdPrefix="media-filter"
                hideLabelBelow="lg"
              />

              {/* Smart EXIF & Date Filters Button */}
              {onOpenExifFilters && (
                <button
                  onClick={onOpenExifFilters}
                  className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                    activeExifFilterCount > 0
                      ? "text-primary bg-primary/10 border-primary/25 font-semibold"
                      : "text-on-surface-variant hover:text-on-surface bg-surface-container-lowest/60 border-outline-variant/15 hover:bg-white/[0.04]"
                  }`}
                  title="Smart EXIF & Metadata Filters"
                  aria-label="Smart EXIF & Metadata Filters"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">Filters</span>
                  {activeExifFilterCount > 0 && (
                    <span className="w-4 h-4 rounded-full bg-primary text-on-primary text-[10px] font-bold flex items-center justify-center -ml-0.5">
                      {activeExifFilterCount}
                    </span>
                  )}
                </button>
              )}

              {/* Sort Menu Dropdown */}
              {onSortChange && (
                <div className="relative" ref={sortMenuRef}>
                  <button
                    onClick={() => setShowSortMenu((p) => !p)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                      showSortMenu
                        ? "text-primary bg-primary/10 border-primary/25"
                        : "text-on-surface-variant hover:text-on-surface bg-surface-container-lowest/60 border-outline-variant/15 hover:bg-white/[0.04]"
                    }`}
                    title="Sort media by date, name, or size"
                    aria-label="Sort media by date, name, or size"
                    aria-haspopup="menu"
                    aria-expanded={showSortMenu}
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">
                      {SORT_LABELS[sortBy]?.label || "Sort"}
                    </span>
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {showSortMenu && (
                    <div className="absolute right-0 top-9 w-48 bg-surface-container-low border border-outline-variant/20 rounded-lg p-1.5 z-50 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                      <div className="text-[10px] font-semibold text-on-surface-variant/70 uppercase tracking-wider px-2 py-1">
                        Sort Timeline By
                      </div>

                      <div className="space-y-0.5 mt-1">
                        {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => {
                          const isCurrent = sortBy === key;
                          return (
                            <button
                              key={key}
                              onClick={() => {
                                onSortChange(key);
                                setShowSortMenu(false);
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left cursor-pointer ${
                                isCurrent
                                  ? "text-primary bg-white/[0.08] font-semibold"
                                  : "text-on-surface-variant hover:bg-white/[0.04] hover:text-on-surface"
                              }`}
                            >
                              <span>{SORT_LABELS[key].label}</span>
                              {isCurrent && (
                                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Layout Switcher (Condensed on desktop, hidden on tablet/mobile) */}
              {onDisplayLayoutChange && (
                <div className="hidden lg:flex items-center gap-0.5 p-0.5 bg-surface-container-lowest/60 border border-outline-variant/15 rounded-lg">
                  {layoutTabs.map((tab) => {
                    const isActive = displayLayout === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => onDisplayLayoutChange(tab.id)}
                        className={`w-7 h-7 flex items-center justify-center rounded-md transition-all duration-150 cursor-pointer ${
                          isActive
                            ? "bg-surface-container text-primary font-medium border border-outline-variant/20 shadow-xs"
                            : "text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04]"
                        }`}
                        title={tab.label}
                        aria-label={tab.label}
                      >
                        <span className="scale-90">{tab.icon}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Battery Saver / Low-Power Mode Toggle (Persistent across all views) */}
          {onToggleBatterySaver && (
            <button
              onClick={onToggleBatterySaver}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-colors cursor-pointer shrink-0 touch-manipulation ${
                batterySaver
                  ? "text-amber-400 bg-amber-400/10 border-amber-400/30"
                  : "text-on-surface-variant hover:text-on-surface bg-surface-container-lowest/60 border-outline-variant/15 hover:bg-white/[0.04]"
              }`}
              title={
                batterySaver
                  ? "Battery Saver: Active (video previews & loops paused to save battery/data)"
                  : "Battery Saver: Off (Click to pause animated loops & save power)"
              }
              aria-label={
                batterySaver
                  ? "Battery Saver: Active (click to disable)"
                  : "Battery Saver: Off (click to enable)"
              }
            >
              {batterySaver ? (
                <ZapOff className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Light / Dark Mode Toggle Button (Persistent across all views) */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant/15 bg-surface-container-lowest/60 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] transition-colors cursor-pointer shrink-0 touch-manipulation"
              title={`Switch Mode (Active: ${getThemeById(currentTheme).name})`}
              aria-label={`Switch Mode (Active: ${getThemeById(currentTheme).name})`}
            >
              {theme === "dark" ? (
                <Sun className="w-3.5 h-3.5 text-amber-300" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

