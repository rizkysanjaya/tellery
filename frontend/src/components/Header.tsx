/**
 * =============================================================================
 * Module: frontend/src/components/Header.tsx
 * Purpose: Neomorphic top navigation header with spotlight search, responsive breakpoint
 *          collapsing (768px-1150px), segmented filter pills, smart EXIF & date filter trigger,
 *          sort popover menu, universal theme toggle, battery saver toggle, and layout switchers.
 * Used by: frontend/src/App.tsx
 * Dependencies: lucide-react, frontend/src/types.ts, AnimatedTabs
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
    : "Search vault (photos, videos, cameras, 2026)...";

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
    <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-outline-variant/15 px-4 lg:px-8 py-3 transition-all">
      <div className="flex items-center justify-between gap-4">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={onToggleMobileSidebar}
          className="p-2 -ml-2 neo-button rounded-full text-on-surface-variant hover:text-primary md:hidden cursor-pointer transition-all w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0 touch-manipulation"
          title="Open Navigation"
          aria-label="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Spotlight Search Input */}
        <div className="relative flex-1 min-w-[140px] sm:min-w-[180px] md:min-w-[220px] max-w-xl group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant group-focus-within:text-primary transition-colors z-10" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-14 sm:pr-20 py-2.5 bg-surface-base rounded-neo-lg text-sm font-medium text-on-surface placeholder-on-surface-variant outline-none transition-all neo-pressed focus:ring-1 focus:ring-primary/40"
          />

          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 z-10">
            {searchQuery ? (
              <button
                onClick={() => onSearchChange("")}
                className="p-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-md transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center touch-manipulation"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onOpenCommandPalette}
                className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 rounded-neo bg-surface-container neo-raised text-[10px] font-mono font-bold text-on-surface-variant hover:text-primary cursor-pointer select-none transition-all"
                title="Open Command Palette (Ctrl+K)"
              >
                <Command className="w-3 h-3" />K
              </button>
            )}
          </div>
        </div>

        {/* Controls: Filter Pills, Sort Dropdown & Layout Switcher */}
        {/* Right-Hand Controls Container */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {currentView === "timeline" && (
            <>
              {/* Neomorphic Filter Pills (All / Photos / Videos) with responsive text collapsing */}
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
                  className={`relative flex items-center gap-1.5 px-2.5 sm:px-3 lg:px-4 py-2 sm:py-2.5 rounded-neo-lg text-sm font-semibold transition-all cursor-pointer ${
                    activeExifFilterCount > 0
                      ? "neo-pressed text-primary bg-surface-base font-bold shadow-xs"
                      : "neo-raised text-on-surface-variant hover:text-on-surface bg-surface-container hover:scale-[1.02]"
                  }`}
                  title="Smart EXIF & Metadata Filters"
                  aria-label="Smart EXIF & Metadata Filters"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span className="hidden xl:inline">Filters</span>
                  {activeExifFilterCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center -ml-0.5 shadow-xs">
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
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 lg:px-4 py-2 sm:py-2.5 rounded-neo-lg text-sm font-semibold transition-all cursor-pointer ${
                      showSortMenu
                        ? "neo-pressed text-primary bg-surface-base"
                        : "neo-raised text-on-surface-variant hover:text-on-surface bg-surface-container hover:scale-[1.02]"
                    }`}
                    title="Sort media by date, name, or size"
                    aria-label="Sort media by date, name, or size"
                    aria-haspopup="menu"
                    aria-expanded={showSortMenu}
                  >
                    <ArrowUpDown className="w-4 h-4" />
                    <span className="hidden xl:inline">
                      {SORT_LABELS[sortBy]?.label || "Sort"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>

                  {showSortMenu && (
                    <div className="absolute right-0 top-12 w-56 bg-surface-base rounded-neo-xl neo-card p-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                      <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-3 py-2">
                        Sort Timeline By
                      </div>

                      <div className="space-y-1 mt-1">
                        {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => {
                          const isCurrent = sortBy === key;
                          return (
                            <button
                              key={key}
                              onClick={() => {
                                onSortChange(key);
                                setShowSortMenu(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-neo text-sm font-medium transition-all text-left cursor-pointer ${
                                isCurrent
                                  ? "neo-pressed text-primary bg-surface-container-high"
                                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                              }`}
                            >
                              <span>{SORT_LABELS[key].label}</span>
                              {isCurrent && (
                                <Check className="w-4 h-4 text-primary shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Neomorphic Layout Switcher (Condensed on desktop, hidden on tablet/mobile) */}
              {onDisplayLayoutChange && (
                <div className="hidden lg:flex items-center gap-1 p-1 bg-surface-base rounded-full neo-pressed">
                  {layoutTabs.map((tab) => {
                    const isActive = displayLayout === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => onDisplayLayoutChange(tab.id)}
                        className={`w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer ${
                          isActive
                            ? "neo-raised bg-surface-container text-primary"
                            : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                        }`}
                        title={tab.label}
                        aria-label={tab.label}
                      >
                        {tab.icon}
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
              className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full neo-button bg-surface-base transition-all duration-200 cursor-pointer shrink-0 touch-manipulation ${
                batterySaver
                  ? "text-amber-400 neo-pressed ring-1 ring-amber-400/40 bg-amber-400/10 shadow-[0_0_12px_rgba(251,191,36,0.3)]"
                  : "text-on-surface-variant hover:text-on-surface"
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
                <ZapOff className="w-4 h-4 text-amber-400" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Light / Dark Mode Toggle Button (Persistent across all views) */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full neo-button bg-surface-base text-on-surface hover:text-primary transition-all duration-200 cursor-pointer shrink-0 touch-manipulation"
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              aria-label={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-300" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

