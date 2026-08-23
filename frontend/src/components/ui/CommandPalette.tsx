/**
 * =============================================================================
 * Module: frontend/src/components/ui/CommandPalette.tsx
 * Purpose: 21st.dev / Raycast-style spotlight command palette dialog triggered by
 *          Ctrl+K or header search. Enables rapid keyboard navigation, view switching,
 *          sorting, album jumps, upload actions, and vault synchronization.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, framer-motion, lucide-react, frontend/src/types.ts
 * Public Members: CommandPalette
 * Side Effects: Listens for Ctrl+K keyboard shortcut, dispatches application state actions.
 * =============================================================================
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Clock,
  Folder,
  Upload,
  Grid,
  LayoutGrid,
  Columns,
  List,
  ArrowUpDown,
  X,
  Check,
  RefreshCw,
} from "lucide-react";
import { DisplayLayout, FolderItem, MainView, SortOption } from "../../types";

interface CommandItem {
  id: string;
  category: "Navigation" | "Collections" | "Display Layout" | "Sort Order" | "Actions";
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  active?: boolean;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: MainView;
  activeFolder: FolderItem | null;
  folders: FolderItem[];
  displayLayout: DisplayLayout;
  sortBy: SortOption;
  onSelectTimeline: () => void;
  onSelectAlbumsOverview: () => void;
  onSelectFolder: (folder: FolderItem) => void;
  onDisplayLayoutChange: (layout: DisplayLayout) => void;
  onSortChange: (sort: SortOption) => void;
  onTriggerUpload: () => void;
  onSyncVault?: () => Promise<void>;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  currentView,
  activeFolder,
  folders,
  displayLayout,
  sortBy,
  onSelectTimeline,
  onSelectAlbumsOverview,
  onSelectFolder,
  onDisplayLayoutChange,
  onSortChange,
  onTriggerUpload,
  onSyncVault,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build command list
  const commands: CommandItem[] = [
    // Navigation
    {
      id: "nav-timeline",
      category: "Navigation",
      title: "Main Vault Timeline",
      subtitle: "View all photos and videos chronologically",
      icon: <Clock className="w-4 h-4 text-sky-400" />,
      active: currentView === "timeline" && !activeFolder,
      action: () => {
        onSelectTimeline();
        onClose();
      },
    },
    {
      id: "nav-albums",
      category: "Navigation",
      title: "Collections & Albums",
      subtitle: "Browse custom collections and highlight folders",
      icon: <Folder className="w-4 h-4 text-sky-400" />,
      active: currentView === "albums",
      action: () => {
        onSelectAlbumsOverview();
        onClose();
      },
    },

    // Actions
    {
      id: "action-sync",
      category: "Actions",
      title: "Sync Vault from Telegram",
      subtitle: "Scan Telegram storage channel for newly uploaded media",
      icon: <RefreshCw className="w-4 h-4 text-sky-400" />,
      action: () => {
        if (onSyncVault) onSyncVault();
        onClose();
      },
    },
    {
      id: "action-upload",
      category: "Actions",
      title: "Upload Photos & Videos",
      subtitle: "Archive files into your private Telegram vault",
      icon: <Upload className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onTriggerUpload();
        onClose();
      },
    },

    // Display Layouts
    {
      id: "layout-grid",
      category: "Display Layout",
      title: "Standard Grid View",
      subtitle: "Balanced responsive square cards",
      icon: <Grid className="w-4 h-4 text-sky-400" />,
      active: displayLayout === "grid",
      action: () => {
        onDisplayLayoutChange("grid");
        onClose();
      },
    },
    {
      id: "layout-dense",
      category: "Display Layout",
      title: "Compact Dense Grid",
      subtitle: "High capacity preview grid",
      icon: <LayoutGrid className="w-4 h-4 text-sky-400" />,
      active: displayLayout === "dense",
      action: () => {
        onDisplayLayoutChange("dense");
        onClose();
      },
    },
    {
      id: "layout-masonry",
      category: "Display Layout",
      title: "Natural Aspect Showcase",
      subtitle: "Preserve portrait and widescreen dimensions without cropping",
      icon: <Columns className="w-4 h-4 text-sky-400" />,
      active: displayLayout === "masonry",
      action: () => {
        onDisplayLayoutChange("masonry");
        onClose();
      },
    },
    {
      id: "layout-list",
      category: "Display Layout",
      title: "Detailed Table List View",
      subtitle: "Metadata columns with filename, folder tag, specs, size",
      icon: <List className="w-4 h-4 text-sky-400" />,
      active: displayLayout === "list",
      action: () => {
        onDisplayLayoutChange("list");
        onClose();
      },
    },

    // Sorting
    {
      id: "sort-date-desc",
      category: "Sort Order",
      title: "Date: Newest First",
      icon: <ArrowUpDown className="w-4 h-4 text-sky-400" />,
      active: sortBy === "date_desc",
      action: () => {
        onSortChange("date_desc");
        onClose();
      },
    },
    {
      id: "sort-date-asc",
      category: "Sort Order",
      title: "Date: Oldest First",
      icon: <ArrowUpDown className="w-4 h-4 text-sky-400" />,
      active: sortBy === "date_asc",
      action: () => {
        onSortChange("date_asc");
        onClose();
      },
    },
    {
      id: "sort-name-asc",
      category: "Sort Order",
      title: "Name: A → Z",
      icon: <ArrowUpDown className="w-4 h-4 text-sky-400" />,
      active: sortBy === "name_asc",
      action: () => {
        onSortChange("name_asc");
        onClose();
      },
    },
    {
      id: "sort-size-desc",
      category: "Sort Order",
      title: "Size: Largest First",
      icon: <ArrowUpDown className="w-4 h-4 text-sky-400" />,
      active: sortBy === "size_desc",
      action: () => {
        onSortChange("size_desc");
        onClose();
      },
    },

    // Collections
    ...folders.map((folder) => ({
      id: `folder-${folder.id}`,
      category: "Collections" as const,
      title: folder.name,
      subtitle: `${folder.item_count} items in collection`,
      icon: <Folder className="w-4 h-4 text-amber-400" />,
      active: activeFolder?.id === folder.id,
      action: () => {
        onSelectFolder(folder);
        onClose();
      },
    })),
  ];

  // Filter commands by search query
  const filteredCommands = query.trim()
    ? commands.filter(
        (c) =>
          c.title.toLowerCase().includes(query.toLowerCase()) ||
          c.category.toLowerCase().includes(query.toLowerCase()) ||
          (c.subtitle && c.subtitle.toLowerCase().includes(query.toLowerCase()))
      )
    : commands;

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev <= 0 ? filteredCommands.length - 1 : prev - 1
      );
    } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
      e.preventDefault();
      filteredCommands[selectedIndex].action();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 select-none">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-xl"
          />

          {/* Command Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="relative w-full max-w-xl bg-zinc-950/90 border border-white/[0.12] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] backdrop-blur-3xl overflow-hidden z-10 ring-1 ring-white/5"
            onKeyDown={handleKeyDown}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08] bg-zinc-900/40">
              <Search className="w-5 h-5 text-sky-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Type a command, search collections, or switch layouts..."
                className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
              />
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Command List Body */}
            <div className="max-h-96 overflow-y-auto p-2 space-y-1">
              {filteredCommands.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  No matching commands found.
                </div>
              ) : (
                filteredCommands.map((command, idx) => {
                  const isSelected = selectedIndex === idx;
                  return (
                    <div
                      key={command.id}
                      onClick={command.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-sky-500/15 border border-sky-500/30 text-white"
                          : "hover:bg-zinc-900/60 text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            isSelected
                              ? "bg-sky-500/20 text-sky-300"
                              : "bg-zinc-900 border border-white/[0.06] text-zinc-400"
                          }`}
                        >
                          {command.icon}
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold truncate">
                              {command.title}
                            </span>
                            {command.active && (
                              <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 text-[10px] font-mono border border-sky-500/30">
                                Active
                              </span>
                            )}
                          </div>
                          {command.subtitle && (
                            <p className="text-[11px] text-zinc-400 truncate">
                              {command.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-zinc-400 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                          {command.category}
                        </span>
                        {command.active && (
                          <Check className="w-3.5 h-3.5 text-sky-400" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Shortcut Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/50 border-t border-white/[0.06] text-[11px] text-zinc-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[9px] font-mono">↑↓</kbd> to navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[9px] font-mono">↵</kbd> to select
                </span>
              </div>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[9px] font-mono">Esc</kbd> to close
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
