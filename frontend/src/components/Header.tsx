/**
 * =============================================================================
 * Module: frontend/src/components/Header.tsx
 * Purpose: Top navigation bar containing branding, search bar, filters, upload button, and stats.
 * Used by: frontend/src/App.tsx
 * Dependencies: lucide-react, frontend/src/types.ts
 * Public Members: Header
 * Side Effects: Dispatches search, filter, and upload file events to parent state.
 * =============================================================================
 */

import React, { useRef } from "react";
import { Search, Image as ImageIcon, Video, Layers, HardDrive, Upload, Loader2 } from "lucide-react";
import { FilterType, StatsResponse } from "../types";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeFilter: FilterType;
  onFilterChange: (f: FilterType) => void;
  stats: StatsResponse | null;
  onUploadFiles: (files: FileList) => void;
  isUploading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  stats,
  onUploadFiles,
  isUploading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadFiles(e.target.files);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/80 px-4 lg:px-8 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div className="flex items-center justify-between w-full md:w-auto gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                TeleGallery
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Vault
                </span>
              </h1>
            </div>
          </div>

          {/* Upload Button (Mobile) */}
          <div className="md:hidden flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept="image/*,video/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-500 hover:bg-sky-600 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-500/20 transition-all"
            >
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>Upload</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search photos, videos, cameras (e.g. iPhone, 2026)..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800 focus:border-sky-500/80 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all focus:ring-2 focus:ring-sky-500/20"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills, Upload Button & Stats */}
        <div className="flex items-center justify-between w-full md:w-auto gap-3">
          <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => onFilterChange("all")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeFilter === "all"
                  ? "bg-sky-500 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              All
            </button>
            <button
              onClick={() => onFilterChange("photo")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeFilter === "photo"
                  ? "bg-sky-500 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Photos
            </button>
            <button
              onClick={() => onFilterChange("video")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeFilter === "video"
                  ? "bg-sky-500 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              Videos
            </button>
          </div>

          {/* Upload Button (Desktop) */}
          <div className="hidden md:flex items-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept="image/*,video/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
            >
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>{isUploading ? "Uploading..." : "Upload"}</span>
            </button>
          </div>

          {/* Desktop Storage Pill */}
          {stats && (
            <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-zinc-400 bg-zinc-900/90 px-3.5 py-2 rounded-xl border border-zinc-800">
              <HardDrive className="w-4 h-4 text-sky-400" />
              <span>{stats.total_items} items</span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-300 font-semibold">{stats.total_size_formatted}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
