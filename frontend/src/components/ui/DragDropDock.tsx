/**
 * =============================================================================
 * Module: frontend/src/components/ui/DragDropDock.tsx
 * Purpose: Bottom action dock with individual solid-themed circular drop targets
 *          featuring realistic water droplet physics:
 *          - Small circle emerges from below -> stretches into an oval during ascent -> squashes and settles into a full circle
 *          - Staggered in left-to-right order (Add to Album -> Favorite -> Delete -> Cancel)
 *          - Solid theme background (no transparent/hazy backgrounds)
 *          - Enlarged icons with distinct action colors
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, framer-motion, frontend/src/types.ts, FolderIcon
 * Public Members: DragDropDock
 * Side Effects: Dispatches bulk delete prompt, album assignments, favorite toggling, and deselect on drop.
 * =============================================================================
 */

import React, { useState } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Trash2, FolderPlus, Star, X } from "lucide-react";
import { FolderItem } from "../../types";
import { FolderIcon } from "./FolderIcon";

interface DragDropDockProps {
  isVisible: boolean;
  folders: FolderItem[];
  draggedMediaIds: number[];
  onDropTrash: (mediaIds: number[]) => void;
  onDropAlbum: (folderId: number, mediaIds: number[]) => void;
  onDropFavorite: (mediaIds: number[]) => void;
  onDropDeselect: () => void;
}

// Container coordinates left-to-right stagger order
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08, // Stagger from left to right
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.04,
      staggerDirection: -1,
    },
  },
};

// Realistic water droplet keyframe animation:
// Small circle (scale 0.2) -> stretched oval during rise (scaleX: 0.7, scaleY: 1.4) -> squash at apex (scaleX: 1.12, scaleY: 0.92) -> full round circle (scale: 1)
const dropletVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 85,
    scaleX: 0.2,
    scaleY: 0.2,
    borderRadius: "50%",
  },
  visible: {
    opacity: [0, 1, 1, 1],
    y: [85, -8, 3, 0],
    scaleX: [0.2, 0.7, 1.12, 1],
    scaleY: [0.2, 1.4, 0.92, 1],
    borderRadius: "50%",
    transition: {
      duration: 0.52,
      times: [0, 0.55, 0.8, 1],
      ease: ["easeInOut", "easeOut", "easeOut"],
    },
  },
  exit: {
    opacity: [1, 1, 0],
    y: [0, -10, 75],
    scaleX: [1, 0.8, 0.2],
    scaleY: [1, 1.35, 0.2],
    borderRadius: "50%",
    transition: {
      duration: 0.32,
      times: [0, 0.3, 1],
      ease: "easeInOut",
    },
  },
};

export const DragDropDock: React.FC<DragDropDockProps> = ({
  isVisible,
  folders,
  draggedMediaIds,
  onDropTrash,
  onDropAlbum,
  onDropFavorite,
  onDropDeselect,
}) => {
  const [isHoveringAlbumTarget, setIsHoveringAlbumTarget] = useState(false);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  // Filter out standalone albums and collection child albums
  const availableAlbums = folders.filter((f) => !f.is_collection);

  const handleDragOver = (e: React.DragEvent, targetName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(targetName);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
  };

  const handleDropTrash = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    setIsHoveringAlbumTarget(false);
    onDropTrash(draggedMediaIds);
  };

  const handleDropFavorite = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    setIsHoveringAlbumTarget(false);
    onDropFavorite(draggedMediaIds);
  };

  const handleDropDeselect = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    setIsHoveringAlbumTarget(false);
    onDropDeselect();
  };

  const handleDropSpecificAlbum = (e: React.DragEvent, folderId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    setIsHoveringAlbumTarget(false);
    onDropAlbum(folderId, draggedMediaIds);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-[9990] flex flex-col items-center pointer-events-auto select-none">
          {/* Expandable Album Selection Grid Popup */}
          <AnimatePresence>
            {isHoveringAlbumTarget && availableAlbums.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 25, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 25, scale: 0.94 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsHoveringAlbumTarget(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="mb-4 w-[94vw] max-w-xl sm:max-w-2xl p-4 sm:p-5 rounded-neo-2xl bg-surface-base border border-outline-variant/30 neo-card shadow-[0_20px_50px_rgba(0,0,0,0.4)]"
              >
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                    <FolderPlus className="w-4 h-4 text-primary" />
                    <span>Drop into an album ({draggedMediaIds.length} {draggedMediaIds.length === 1 ? "item" : "items"})</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-1 pr-1.5">
                  {availableAlbums.map((album) => {
                    const isTarget = dragOverTarget === `album-${album.id}`;
                    return (
                      <div
                        key={album.id}
                        onDragOver={(e) => handleDragOver(e, `album-${album.id}`)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDropSpecificAlbum(e, album.id)}
                        className={`flex items-center gap-3 p-3 rounded-neo-xl border min-w-0 transition-all duration-150 cursor-pointer overflow-hidden ${
                          isTarget
                            ? "bg-primary/20 border-primary text-primary scale-[1.02] shadow-md ring-2 ring-primary"
                            : "bg-surface-container-low border-outline-variant/15 text-on-surface hover:bg-surface-container hover:border-outline-variant/30"
                        }`}
                      >
                        <FolderIcon
                          name={album.icon || "Folder"}
                          color={album.color || "var(--color-primary, #6366f1)"}
                          className="w-5 h-5 shrink-0"
                        />
                        <div className="min-w-0 flex-1 truncate">
                          <div className="text-xs font-bold truncate text-on-surface">{album.name}</div>
                          <div className="text-[11px] text-on-surface-variant font-mono">
                            {album.item_count} items
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Individual Solid Theme Water Droplet Circles (No wrapping box; Left-to-Right Droplet Stagger) */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex items-center gap-3.5 sm:gap-5 pointer-events-auto"
          >
            {/* Droplet 1: Add to Album (FolderPlus) */}
            <motion.div
              variants={dropletVariants}
              onDragOver={(e) => {
                handleDragOver(e, "album");
                setIsHoveringAlbumTarget(true);
              }}
              onDragLeave={handleDragLeave}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer border ${
                dragOverTarget === "album" || isHoveringAlbumTarget
                  ? "bg-primary text-on-primary border-primary scale-110 shadow-xl shadow-primary/40 ring-2 ring-primary/50"
                  : "bg-surface-base border-outline-variant/40 text-primary hover:bg-surface-container hover:scale-105 shadow-lg shadow-black/10 dark:shadow-black/40"
              }`}
              title="Add to Album (Drop here)"
            >
              <FolderPlus className={`w-6 h-6 sm:w-7 sm:h-7 ${dragOverTarget === "album" || isHoveringAlbumTarget ? "text-on-primary" : "text-primary"}`} />
            </motion.div>

            {/* Droplet 2: Star / Favorite */}
            <motion.div
              variants={dropletVariants}
              onDragOver={(e) => {
                handleDragOver(e, "favorite");
                setIsHoveringAlbumTarget(false);
              }}
              onDragLeave={handleDragLeave}
              onDrop={handleDropFavorite}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer border ${
                dragOverTarget === "favorite"
                  ? "bg-amber-500 text-white border-amber-400 scale-110 shadow-xl shadow-amber-500/40 ring-2 ring-amber-400/50"
                  : "bg-surface-base border-outline-variant/40 text-amber-500 hover:bg-surface-container hover:scale-105 shadow-lg shadow-black/10 dark:shadow-black/40"
              }`}
              title="Add to Favorites (Drop here)"
            >
              <Star className={`w-6 h-6 sm:w-7 sm:h-7 ${dragOverTarget === "favorite" ? "fill-white text-white" : "fill-amber-400 text-amber-500"}`} />
            </motion.div>

            {/* Droplet 3: Trash / Delete */}
            <motion.div
              variants={dropletVariants}
              onDragOver={(e) => {
                handleDragOver(e, "trash");
                setIsHoveringAlbumTarget(false);
              }}
              onDragLeave={handleDragLeave}
              onDrop={handleDropTrash}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer border ${
                dragOverTarget === "trash"
                  ? "bg-error text-on-error border-error scale-110 shadow-xl shadow-error/40 ring-2 ring-error/50"
                  : "bg-surface-base border-outline-variant/40 text-error hover:bg-surface-container hover:scale-105 shadow-lg shadow-black/10 dark:shadow-black/40"
              }`}
              title="Delete Selected (Drop here)"
            >
              <Trash2 className={`w-6 h-6 sm:w-7 sm:h-7 ${dragOverTarget === "trash" ? "text-on-error" : "text-error"}`} />
            </motion.div>

            {/* Droplet 4: Deselect / Cancel */}
            <motion.div
              variants={dropletVariants}
              onDragOver={(e) => {
                handleDragOver(e, "deselect");
                setIsHoveringAlbumTarget(false);
              }}
              onDragLeave={handleDragLeave}
              onDrop={handleDropDeselect}
              className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer border ${
                dragOverTarget === "deselect"
                  ? "bg-surface-container-highest text-on-surface border-outline scale-110 shadow-md"
                  : "bg-surface-base border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:bg-surface-container hover:scale-105 shadow-lg shadow-black/10 dark:shadow-black/40"
              }`}
              title="Cancel Selection (Drop here)"
            >
              <X className="w-6 h-6 sm:w-7 sm:h-7" />
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
