/**
 * =============================================================================
 * Module: frontend/src/components/Header.tsx
 * Purpose: Top search and filter bar supporting mobile sidebar drawer toggling,
 *          media type filters (All/Photos/Videos), and search queries.
 * Used by: frontend/src/App.tsx
 * Dependencies: lucide-react, frontend/src/types.ts
 * Public Members: Header
 * Side Effects: Dispatches search and filter events to parent state.
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
  List,
  Columns3,
  ArrowUpDown,
  Check,
  ChevronDown,
} from "lucide-react";
import { DisplayLayout, FilterType, MainView, SortOption } from "../types";

interface HeaderProps {
  currentView: MainView;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: FilterType;
  onFilterChange: (f: FilterType) => void;
  displayLayout?: DisplayLayout;
  onDisplayLayoutChange?: (l: DisplayLayout) => void;
  sortBy?: SortOption;
  onSortChange?: (sort: SortOption) => void;
  onToggleMobileSidebar: () => void;
}

const SORT_LABELS: Record<SortOption, { label: string; group: string }> = {
  date_desc: { label: "Newest First", group: "Date" },
  date_asc: { label: "Oldest First", group: "Date" },
  name_asc: { label: "Name (A → Z)", group: "Name" },
  name_desc: { label: "Name (Z → A)", group: "Name" },
  size_desc: { label: "Size (Largest First)", group: "Size" },
  size_asc: { label: "Size (Smallest First)", group: "Size" },
};

export const Header: React.FC<HeaderProps> = ({
  currentView,
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  displayLayout = "grid",
  onDisplayLayoutChange,
  sortBy = "date_desc",
  onSortChange,
  onToggleMobileSidebar,
}) => {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

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

  return (
    <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-4 lg:px-8 py-3 transition-all">
      <div className="flex items-center justify-between gap-3">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={onToggleMobileSidebar}
          className="p-2 -ml-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-900 md:hidden cursor-pointer"
          title="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search Input */}
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search photos, videos, cameras (e.g. iPhone, 2026)..."
            className="w-full pl-10 pr-14 py-2 bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800 focus:border-sky-500/80 rounded-xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:ring-2 focus:ring-sky-500/20"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Controls: Filter Pills, Sort Dropdown & Layout Switcher */}
        {currentView === "timeline" && (
          <div className="flex items-center gap-2 shrink-0">
            {/* Filter Pills (All / Photos / Videos) */}
            <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
              <button
                onClick={() => onFilterChange("all")}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeFilter === "all"
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
                title="Show all media"
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">All</span>
              </button>
              <button
                onClick={() => onFilterChange("photo")}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeFilter === "photo"
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
                title="Filter photos only"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Photos</span>
              </button>
              <button
                onClick={() => onFilterChange("video")}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeFilter === "video"
                    ? "bg-sky-500 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
                title="Filter videos only"
              >
                <Video className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Videos</span>
              </button>
            </div>

            {/* Sort Menu Dropdown */}
            {onSortChange && (
              <div className="relative" ref={sortMenuRef}>
                <button
                  onClick={() => setShowSortMenu((p) => !p)}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                    showSortMenu
                      ? "bg-sky-500/15 border-sky-500/40 text-sky-300"
                      : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800/80"
                  }`}
                  title="Sort media by date, name, or size"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="hidden md:inline">
                    {SORT_LABELS[sortBy]?.label || "Sort"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                </button>

                {showSortMenu && (
                  <div className="absolute right-0 top-11 w-56 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl backdrop-blur-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2.5 py-1">
                      Sort Timeline By
                    </div>

                    <div className="space-y-0.5 mt-0.5">
                      {(Object.keys(SORT_LABELS) as SortOption[]).map((key) => {
                        const isCurrent = sortBy === key;
                        return (
                          <button
                            key={key}
                            onClick={() => {
                              onSortChange(key);
                              setShowSortMenu(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                              isCurrent
                                ? "bg-sky-500/15 text-sky-300 border border-sky-500/30"
                                : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                            }`}
                          >
                            <span>{SORT_LABELS[key].label}</span>
                            {isCurrent && (
                              <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Display Layout Switcher */}
            {onDisplayLayoutChange && (
              <div className="hidden sm:flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                <button
                  onClick={() => onDisplayLayoutChange("grid")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    displayLayout === "grid"
                      ? "bg-sky-500 text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                  title="Standard Grid view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDisplayLayoutChange("dense")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    displayLayout === "dense"
                      ? "bg-sky-500 text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                  title="Dense Compact Grid view"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDisplayLayoutChange("masonry")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    displayLayout === "masonry"
                      ? "bg-sky-500 text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                  title="Natural Aspect Ratio Showcase"
                >
                  <Columns3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDisplayLayoutChange("list")}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    displayLayout === "list"
                      ? "bg-sky-500 text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                  }`}
                  title="Detailed Table / List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
