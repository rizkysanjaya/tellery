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

import React from "react";
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
} from "lucide-react";
import { DisplayLayout, FilterType, MainView } from "../types";

interface HeaderProps {
  currentView: MainView;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: FilterType;
  onFilterChange: (f: FilterType) => void;
  displayLayout?: DisplayLayout;
  onDisplayLayoutChange?: (l: DisplayLayout) => void;
  onToggleMobileSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  displayLayout = "grid",
  onDisplayLayoutChange,
  onToggleMobileSidebar,
}) => {
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

        {/* Controls: Filter Pills & Layout Switcher */}
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
