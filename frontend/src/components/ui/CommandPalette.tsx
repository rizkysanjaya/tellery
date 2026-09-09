/**
 * =============================================================================
 * Module: frontend/src/components/ui/CommandPalette.tsx
 * Purpose: Precision spotlight command palette dialog triggered by Ctrl+K or header search.
 *          Enables rapid keyboard navigation (Timeline, Favorites, Albums), view switching,
 *          sorting, album jumps, upload actions, vault sync, instant VS Code-style color theme switching,
 *          and Ko-fi project support action.
 * Used by: frontend/src/App.tsx, frontend/src/components/Header.tsx
 * Dependencies: React, framer-motion, lucide-react, frontend/src/types.ts, frontend/src/config/themes.ts
 * Public Members: CommandPalette
 * Side Effects: Listens for Ctrl+K keyboard shortcut, dispatches application state actions, opens external Ko-fi URL.
 * =============================================================================
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Clock,
  Folder,
  Star,
  Upload,
  Grid,
  LayoutGrid,
  Columns,
  List,
  ArrowUpDown,
  X,
  Check,
  RefreshCw,
  Sun,
  Moon,
  Coffee,
} from "lucide-react";
import { DisplayLayout, FolderItem, MainView, SortOption } from "../../types";
import { THEMES, ThemeId } from "../../config/themes";

interface CommandItem {
  id: string;
  category: "Navigation" | "Collections" | "Display Layout" | "Sort Order" | "Actions" | "Themes" | "Support";
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
  onSelectFavorites?: () => void;
  onSelectFolder: (folder: FolderItem) => void;
  onDisplayLayoutChange: (layout: DisplayLayout) => void;
  onSortChange: (sort: SortOption) => void;
  onTriggerUpload: () => void;
  onSyncVault?: () => Promise<void>;
  theme?: "dark" | "light";
  currentTheme?: ThemeId;
  onSelectTheme?: (themeId: ThemeId) => void;
  onToggleTheme?: () => void;
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
  onSelectFavorites,
  onSelectFolder,
  onDisplayLayoutChange,
  onSortChange,
  onTriggerUpload,
  onSyncVault,
  theme = "dark",
  currentTheme = "obsidian",
  onSelectTheme,
  onToggleTheme,
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
      title: "Go to Timeline",
      subtitle: "Chronological feed of all photos and videos",
      icon: <Clock className="w-4 h-4" />,
      active: currentView === "timeline" && !activeFolder,
      action: () => {
        onSelectTimeline();
        onClose();
      },
    },
    {
      id: "nav-favorites",
      category: "Navigation",
      title: "Go to Favorites",
      subtitle: "Quick access to starred photos, videos, and collections",
      icon: <Star className="w-4 h-4" />,
      active: currentView === "favorites" && !activeFolder,
      action: () => {
        onSelectFavorites?.();
        onClose();
      },
    },
    {
      id: "nav-albums",
      category: "Navigation",
      title: "Go to Albums",
      subtitle: "Browse all organized albums and smart folders",
      icon: <Folder className="w-4 h-4" />,
      active: currentView === "albums" && !activeFolder,
      action: () => {
        onSelectAlbumsOverview();
        onClose();
      },
    },

    // Actions
    {
      id: "action-upload",
      category: "Actions",
      title: "Upload Media",
      subtitle: "Upload new photos or videos to current vault",
      icon: <Upload className="w-4 h-4" />,
      action: () => {
        onTriggerUpload();
        onClose();
      },
    },
    ...(onSyncVault
      ? [
          {
            id: "action-sync",
            category: "Actions" as const,
            title: "Sync Vault",
            subtitle: "Scan Telegram channel for new incoming files",
            icon: <RefreshCw className="w-4 h-4" />,
            action: () => {
              onSyncVault();
              onClose();
            },
          },
        ]
      : []),
    ...(onToggleTheme
      ? [
          {
            id: "action-theme",
            category: "Actions" as const,
            title: `Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`,
            subtitle: "Toggle application color scheme",
            icon: theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />,
            action: () => {
              onToggleTheme();
              onClose();
            },
          },
        ]
      : []),

    // VS Code-Style Color Themes
    ...(onSelectTheme
      ? THEMES.map((t) => ({
          id: `theme-${t.id}`,
          category: "Themes" as const,
          title: `Theme: ${t.name}`,
          subtitle: `${t.mode === "dark" ? "Dark" : "Light"} mode • ${t.description}`,
          icon: (
            <span
              className="w-3.5 h-3.5 rounded-full border border-black/30 shadow-xs inline-block shrink-0"
              style={{ backgroundColor: t.primaryHex }}
            />
          ),
          active: currentTheme === t.id,
          action: () => {
            onSelectTheme(t.id);
            onClose();
          },
        }))
      : []),

    // Display Layout Switcher
    {
      id: "layout-grid",
      category: "Display Layout",
      title: "Grid View",
      subtitle: "Balanced square grid preview layout",
      icon: <LayoutGrid className="w-4 h-4" />,
      active: displayLayout === "grid",
      action: () => {
        onDisplayLayoutChange("grid");
        onClose();
      },
    },
    {
      id: "layout-dense",
      category: "Display Layout",
      title: "Dense View",
      subtitle: "Compact thumbnail view for high density scanning",
      icon: <Grid className="w-4 h-4" />,
      active: displayLayout === "dense",
      action: () => {
        onDisplayLayoutChange("dense");
        onClose();
      },
    },
    {
      id: "layout-masonry",
      category: "Display Layout",
      title: "Natural Aspect (Masonry)",
      subtitle: "Preserves native photo and video aspect ratios",
      icon: <Columns className="w-4 h-4" />,
      active: displayLayout === "masonry",
      action: () => {
        onDisplayLayoutChange("masonry");
        onClose();
      },
    },
    {
      id: "layout-list",
      category: "Display Layout",
      title: "Detailed List",
      subtitle: "Detailed table view with file sizes, dimensions, and dates",
      icon: <List className="w-4 h-4" />,
      active: displayLayout === "list",
      action: () => {
        onDisplayLayoutChange("list");
        onClose();
      },
    },

    // Sort Options
    {
      id: "sort-newest",
      category: "Sort Order",
      title: "Sort: Newest First",
      icon: <ArrowUpDown className="w-4 h-4" />,
      active: sortBy === "date_desc",
      action: () => {
        onSortChange("date_desc");
        onClose();
      },
    },
    {
      id: "sort-oldest",
      category: "Sort Order",
      title: "Sort: Oldest First",
      icon: <ArrowUpDown className="w-4 h-4" />,
      active: sortBy === "date_asc",
      action: () => {
        onSortChange("date_asc");
        onClose();
      },
    },
    {
      id: "sort-name-asc",
      category: "Sort Order",
      title: "Sort: Name (A → Z)",
      icon: <ArrowUpDown className="w-4 h-4" />,
      active: sortBy === "name_asc",
      action: () => {
        onSortChange("name_asc");
        onClose();
      },
    },
    {
      id: "sort-name-desc",
      category: "Sort Order",
      title: "Sort: Name (Z → A)",
      icon: <ArrowUpDown className="w-4 h-4" />,
      active: sortBy === "name_desc",
      action: () => {
        onSortChange("name_desc");
        onClose();
      },
    },
    {
      id: "sort-size-desc",
      category: "Sort Order",
      title: "Sort: Size (Largest)",
      icon: <ArrowUpDown className="w-4 h-4" />,
      active: sortBy === "size_desc",
      action: () => {
        onSortChange("size_desc");
        onClose();
      },
    },
    {
      id: "sort-size-asc",
      category: "Sort Order",
      title: "Sort: Size (Smallest)",
      icon: <ArrowUpDown className="w-4 h-4" />,
      active: sortBy === "size_asc",
      action: () => {
        onSortChange("size_asc");
        onClose();
      },
    },

    // Collections (dynamic)
    ...folders.map((folder) => ({
      id: `folder-${folder.id}`,
      category: "Collections" as const,
      title: folder.name,
      subtitle: `${folder.item_count} items`,
      icon: <Folder className="w-4 h-4" />,
      active: activeFolder?.id === folder.id,
      action: () => {
        onSelectFolder(folder);
        onClose();
      },
    })),

    // Support & Community
    {
      id: "support-kofi",
      category: "Support" as const,
      title: "Support Tellery on Ko-fi",
      subtitle: "Buy the creator a coffee at ko-fi.com/gomski",
      icon: <Coffee className="w-4 h-4 text-amber-500" />,
      action: () => {
        window.open("https://ko-fi.com/gomski", "_blank", "noopener,noreferrer");
        onClose();
      },
    },
  ];

  // Filter commands by search query
  const filteredCommands = commands.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q)) ||
      cmd.category.toLowerCase().includes(q)
    );
  });

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredCommands.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCommands.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
          />

          {/* Command Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="relative w-full max-w-xl bg-surface-container-low/95 backdrop-blur-md border border-outline-variant/20 rounded-2xl shadow-2xl overflow-hidden z-10"
            onKeyDown={handleKeyDown}
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-outline-variant/15 bg-transparent">
              <Search className="w-4 h-4 text-primary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Type a command, search collections, or switch layouts..."
                className="w-full bg-surface-container-lowest/60 border border-outline-variant/15 text-on-surface rounded-lg text-xs placeholder-on-surface-variant/50 outline-none px-3 py-1.5 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              />
              <button
                onClick={onClose}
                className="p-1 rounded-md hover:bg-white/[0.06] text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Command List Body */}
            <div className="max-h-96 overflow-y-auto p-2 space-y-0.5">
              {filteredCommands.length === 0 ? (
                <div className="py-12 text-center text-on-surface-variant/60 text-xs">
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
                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors duration-150 ${
                        isSelected
                          ? "bg-white/[0.08] text-primary"
                          : "hover:bg-white/[0.04] text-on-surface"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`p-1.5 rounded-md shrink-0 ${
                            isSelected
                              ? "text-primary"
                              : "text-on-surface-variant/70"
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
                              <span className="px-1.5 py-0.2 rounded bg-surface-container border border-outline-variant/15 text-primary text-[10px] font-mono">
                                Active
                              </span>
                            )}
                          </div>
                          {command.subtitle && (
                            <p className={`text-[11px] truncate ${isSelected ? "text-primary/70" : "text-on-surface-variant/60"}`}>
                              {command.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant/10 text-on-surface-variant/70">
                          {command.category}
                        </span>
                        {command.active && (
                          <Check className="w-3.5 h-3.5 text-primary" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Shortcut Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-surface-container-lowest/60 border-t border-outline-variant/10 text-[11px] text-on-surface-variant/70">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-surface-container border border-outline-variant/15 text-[9px] font-mono">↑↓</kbd> to navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 rounded bg-surface-container border border-outline-variant/15 text-[9px] font-mono">↵</kbd> to select
                </span>
              </div>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 rounded bg-surface-container border border-outline-variant/15 text-[9px] font-mono">Esc</kbd> to close
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
