/**
 * =============================================================================
 * Module: frontend/src/components/FavoritesView.tsx
 * Purpose: Dedicated Silk Cloud neomorphic Favorites view featuring two distinct sections:
 *          1. Favorite Albums section with search filtering, cover previews, un-favorite buttons, and click navigation
 *          2. Favorite Media section with search queries, strictly filtered favorited media items,
 *             full TimelineGrid search empty states, multi-select, layout controls, battery saver propagation, and hover previews.
 * Used by: frontend/src/App.tsx (when currentView === 'favorites')
 * Dependencies: React, lucide-react, frontend/src/types.ts, TimelineGrid, FolderIcon
 * Public Members: FavoritesView
 * Side Effects: Dispatches media/album favorite toggles, selection changes, and folder navigation.
 * =============================================================================
 */

import React, { useMemo } from "react";
import { Star, Folder, Image as ImageIcon, Video, Layers, ArrowUpDown } from "lucide-react";
import { DisplayLayout, FilterType, FolderItem, MediaItem, SortOption, TimelineGroup } from "../types";
import { TimelineGrid } from "./TimelineGrid";
import { FolderIcon } from "./ui/FolderIcon";

interface FavoritesViewProps {
  favoriteFolders: FolderItem[];
  mediaGroups: TimelineGroup[];
  selectedIds: Set<number>;
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  displayLayout: DisplayLayout;
  onLayoutChange: (layout: DisplayLayout) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  batterySaver?: boolean;
  searchQuery?: string;
  onClearSearch?: () => void;
  onSelectMedia: (item: MediaItem) => void;
  onToggleSelect: (id: number, e?: React.MouseEvent) => void;
  onSelectAllInGroup: (ids: number[]) => void;
  onDeselectAllInGroup: (ids: number[]) => void;
  onMediaContextMenu: (e: React.MouseEvent, item: MediaItem) => void;
  onSelectFolder: (folder: FolderItem) => void;
  onToggleFavoriteFolder: (folderId: number, isFavorite: boolean) => Promise<void>;
  onToggleFavoriteMedia: (mediaId: number, isFavorite: boolean) => Promise<void>;
  onFolderContextMenu?: (e: React.MouseEvent, folder: FolderItem) => void;
  loading: boolean;
}

export const FavoritesView: React.FC<FavoritesViewProps> = ({
  favoriteFolders,
  mediaGroups,
  selectedIds,
  activeFilter,
  onFilterChange,
  displayLayout,
  onLayoutChange,
  sortBy,
  onSortChange,
  batterySaver = false,
  searchQuery,
  onClearSearch,
  onSelectMedia,
  onToggleSelect,
  onSelectAllInGroup,
  onDeselectAllInGroup,
  onMediaContextMenu,
  onSelectFolder,
  onToggleFavoriteFolder,
  onToggleFavoriteMedia,
  onFolderContextMenu,
  loading,
}) => {
  const isSearchActive = Boolean(searchQuery && searchQuery.trim());

  // Filter favorite albums by search query if active
  const filteredFavoriteFolders = useMemo(() => {
    if (!isSearchActive) return favoriteFolders;
    const q = searchQuery!.toLowerCase().trim();
    return favoriteFolders.filter((f) => f.name.toLowerCase().includes(q));
  }, [favoriteFolders, isSearchActive, searchQuery]);

  // Robust defense-in-depth: strictly filter groups to only include favorited media items
  const favoriteMediaGroups = useMemo(() => {
    return mediaGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => Boolean(item.is_favorite)),
      }))
      .filter((group) => group.items.length > 0);
  }, [mediaGroups]);

  const totalFavoriteMedia = favoriteMediaGroups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <div className="space-y-10 pb-16">
      {/* ========================================================================= */}
      {/* Page Header                                                               */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-outline-variant/15">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-neo-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shadow-inner">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            </div>
            <div>
              <h1 className="text-headline-md font-semibold text-on-surface">Favorites</h1>
              <p className="text-body-sm text-on-surface-variant">
                Your starred albums and favorite media items in one place
              </p>
            </div>
          </div>
        </div>

        {/* Global Summary Counter Pills */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-neo bg-surface-container-low neo-pressed border border-outline-variant/20 flex items-center gap-2 text-xs font-semibold">
            <Folder className="w-3.5 h-3.5 text-primary" />
            <span className="text-on-surface">{favoriteFolders.length}</span>
            <span className="text-on-surface-variant font-normal">Albums</span>
          </div>
          <div className="px-3 py-1.5 rounded-neo bg-surface-container-low neo-pressed border border-outline-variant/20 flex items-center gap-2 text-xs font-semibold">
            <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-on-surface">{totalFavoriteMedia}</span>
            <span className="text-on-surface-variant font-normal">Media</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Section 1: Favorite Albums                                                */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Folder className="w-5 h-5 text-primary" />
            <h2 className="text-title-lg font-semibold text-on-surface">Favorite Albums</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium neo-pressed bg-surface-base text-on-surface-variant">
              {filteredFavoriteFolders.length}
            </span>
          </div>
        </div>

        {filteredFavoriteFolders.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filteredFavoriteFolders.map((album) => (
              <div
                key={album.id}
                onClick={() => onSelectFolder(album)}
                onContextMenu={(e) => onFolderContextMenu?.(e, album)}
                className="group relative neo-card bg-surface-base rounded-neo-xl p-3 border border-outline-variant/20 hover:border-primary/50 transition-all duration-200 cursor-pointer flex flex-col justify-between select-none"
              >
                {/* Album Cover Thumbnail or Icon */}
                <div className="relative aspect-square w-full rounded-neo-lg overflow-hidden bg-surface-container mb-3 neo-pressed flex items-center justify-center">
                  {album.cover_thumbnail_url ? (
                    <img
                      src={album.cover_thumbnail_url}
                      alt={album.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4">
                      <FolderIcon
                        name={album.icon || "Folder"}
                        color={album.color}
                        className="w-12 h-12 text-primary"
                      />
                    </div>
                  )}

                  {/* Star Favorite Toggle Button (top-right of card) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavoriteFolder(album.id, false);
                    }}
                    title="Remove album from Favorites"
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-surface-base/80 backdrop-blur-md border border-amber-500/40 text-amber-400 hover:scale-110 active:scale-95 transition-all shadow-md z-10 cursor-pointer"
                  >
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  </button>
                </div>

                {/* Album Metadata */}
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                    {album.name}
                  </h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {album.item_count} {album.item_count === 1 ? "item" : "items"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : isSearchActive ? (
          <div className="neo-card bg-surface-base/50 rounded-neo-xl p-6 border border-dashed border-outline-variant/30 text-center flex flex-col items-center justify-center space-y-1">
            <p className="text-xs text-on-surface-variant font-medium">
              No favorite albums matching <span className="font-semibold text-primary font-mono">"{searchQuery?.trim()}"</span>
            </p>
          </div>
        ) : (
          <div className="neo-card bg-surface-base/50 rounded-neo-xl p-8 border border-dashed border-outline-variant/30 text-center flex flex-col items-center justify-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant">
              <Folder className="w-6 h-6 opacity-60" />
            </div>
            <p className="text-sm font-semibold text-on-surface">No favorite albums yet</p>
            <p className="text-xs text-on-surface-variant max-w-sm">
              Star any album in the Albums page or sidebar to quickly access it right here.
            </p>
          </div>
        )}
      </section>

      {/* Visual Separator */}
      <div className="border-b border-outline-variant/15" />

      {/* ========================================================================= */}
      {/* Section 2: Favorite Media                                                 */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
            <h2 className="text-title-lg font-semibold text-on-surface">Favorite Media</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium neo-pressed bg-surface-base text-amber-400">
              {totalFavoriteMedia}
            </span>
          </div>

          {/* Section Toolbar: Filter Pills & Layout Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Pills (All / Photos / Videos) */}
            <div className="flex items-center p-1 rounded-neo-lg bg-surface-base neo-pressed border border-outline-variant/20 gap-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => onFilterChange("all")}
                className={`px-3 py-1 rounded-neo transition-all cursor-pointer ${
                  activeFilter === "all"
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => onFilterChange("photo")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-neo transition-all cursor-pointer ${
                  activeFilter === "photo"
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Photos</span>
              </button>
              <button
                type="button"
                onClick={() => onFilterChange("video")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-neo transition-all cursor-pointer ${
                  activeFilter === "video"
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Videos</span>
              </button>
            </div>

            {/* Layout Switcher */}
            <div className="flex items-center p-1 rounded-neo-lg bg-surface-base neo-pressed border border-outline-variant/20 gap-1">
              <button
                type="button"
                onClick={() => onLayoutChange("grid")}
                title="Grid Layout"
                className={`p-1.5 rounded-neo transition-all cursor-pointer ${
                  displayLayout === "grid"
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sort Toggle */}
            <button
              type="button"
              onClick={() => onSortChange(sortBy === "date_desc" ? "date_asc" : "date_desc")}
              title={`Sorting by: ${sortBy}`}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-neo-lg bg-surface-base neo-button border border-outline-variant/20 text-xs font-semibold text-on-surface cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-primary" />
              <span className="font-mono text-[11px]">
                {sortBy === "date_desc" ? "Newest" : "Oldest"}
              </span>
            </button>
          </div>
        </div>

        {totalFavoriteMedia > 0 || isSearchActive || loading ? (
          <TimelineGrid
            groups={favoriteMediaGroups}
            selectedIds={selectedIds}
            searchQuery={searchQuery}
            onClearSearch={onClearSearch}
            emptyContextLabel="in your favorites"
            layout={displayLayout}
            sortBy={sortBy}
            onSortChange={onSortChange}
            batterySaver={batterySaver}
            onSelectMedia={onSelectMedia}
            onToggleSelect={onToggleSelect}
            onSelectAllInGroup={onSelectAllInGroup}
            onDeselectAllInGroup={onDeselectAllInGroup}
            onContextMenu={onMediaContextMenu}
            onToggleFavorite={onToggleFavoriteMedia}
            loading={loading}
          />
        ) : (
          <div className="neo-card bg-surface-base/50 rounded-neo-xl p-12 border border-dashed border-outline-variant/30 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Star className="w-7 h-7 fill-amber-400/50" />
            </div>
            <p className="text-base font-semibold text-on-surface">No favorite media yet</p>
            <p className="text-xs text-on-surface-variant max-w-md leading-relaxed">
              Drag photos, videos, or GIFs to the <strong className="text-amber-400">Favorites</strong> dock button, or click the star button on any media card to collect your favorite memories here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
