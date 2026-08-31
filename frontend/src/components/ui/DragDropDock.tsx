/**
 * =============================================================================
 * Module: frontend/src/components/ui/DragDropDock.tsx
 * Purpose: Bottom action dock with individual solid-themed circular drop targets
 *          featuring fast, buttery-smooth GPU-composited liquid droplet physics:
 *          - Liquid droplet emerges from below, stretches vertically during ascent,
 *            squashes horizontally at apex with liquid surface tension, and settles into a full circle
 *          - Rapid, fluid left-to-right cascade (400ms duration, 50ms stagger)
 *          - Action icons appear strictly AFTER the circle has formed (delay until circle settles)
 *          - Instant icon dismissal on exit before droplet returns underground
 *          - Enlarged icons with generous spacing margin
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

// Container coordinates left-to-right cascade stagger order
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05, // Fast, crisp left-to-right ripple wave
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

// Fast, fluid, 60fps GPU-composited liquid droplet morphing
// Emerges small -> stretches into an oval during ascent -> squashes at apex -> settles into full sphere
const dropletBodyVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 70,
    scaleX: 0.3,
    scaleY: 0.3,
  },
  visible: {
    opacity: [0, 1, 1, 1, 1],
    y: [70, 15, -8, 2, 0],
    scaleX: [0.3, 0.72, 1.16, 0.96, 1],
    scaleY: [0.3, 1.42, 0.88, 1.04, 1],
    transition: {
      duration: 0.4,
      times: [0, 0.45, 0.75, 0.9, 1],
      ease: ["easeInOut", "easeOut", "easeInOut", "easeOut"],
    },
  },
  exit: {
    y: [0, -6, 65],
    scaleX: [1, 0.75, 0.25],
    scaleY: [1, 1.35, 0.25],
    opacity: [1, 1, 0],
    transition: {
      duration: 0.22,
      times: [0, 0.3, 1],
      ease: "easeInOut",
    },
  },
};

// Icon strictly pops in AFTER the droplet circle has formed its spherical shape
const iconVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0,
  },
  visible: {
    opacity: [0, 0, 1, 1],
    scale: [0, 0, 1.2, 1],
    y: [8, 8, -1, 0],
    transition: {
      duration: 0.4,
      times: [0, 0.68, 0.88, 1], // Stays hidden until circle settles at 68%
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    scale: 0.4,
    transition: { duration: 0.1 }, // Disappears immediately on exit
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
                onDragLeave={() => setIsHoveringAlbumTarget(false)}
                className="mb-4 w-[340px] sm:w-[420px] max-h-72 overflow-y-auto bg-surface-base/95 backdrop-blur-xl border border-outline-variant/30 rounded-neo-2xl p-3 shadow-2xl shadow-black/30 dark:shadow-black/70 flex flex-col gap-2 z-30"
              >
                <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-on-surface-variant border-b border-outline-variant/15">
                  <div className="flex items-center gap-1.5">
                    <FolderPlus className="w-3.5 h-3.5 text-primary" />
                    <span>Select Target Album</span>
                  </div>
                  <button
                    onClick={() => setIsHoveringAlbumTarget(false)}
                    className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {availableAlbums.map((album) => {
                    const isTarget = dragOverTarget === `album-${album.id}`;
                    return (
                      <div
                        key={album.id}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverTarget(`album-${album.id}`);
                        }}
                        onDragLeave={() => setDragOverTarget(null)}
                        onDrop={(e) => handleDropSpecificAlbum(e, album.id)}
                        className={`flex items-center gap-2.5 p-2 rounded-neo transition-all duration-150 cursor-pointer border ${
                          isTarget
                            ? "bg-primary/20 border-primary text-primary scale-[1.02] shadow-sm"
                            : "bg-surface-container/60 hover:bg-surface-container border-outline-variant/20 text-on-surface"
                        }`}
                      >
                        <div className="w-7 h-7 rounded-neo bg-surface-base flex items-center justify-center shrink-0 shadow-inner">
                          <FolderIcon
                            name={album.icon || "Folder"}
                            color={album.color}
                            className="w-4 h-4"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold truncate leading-tight">
                            {album.name}
                          </div>
                          <div className="text-[10px] text-on-surface-variant">
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

          {/* Individual Solid Theme Fluid Droplet Circles (Left-to-Right Droplet Stagger) */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex items-center gap-6 sm:gap-8 pointer-events-auto"
          >
            {/* Droplet 1: Add to Album (FolderPlus) */}
            <motion.div
              variants={dropletBodyVariants}
              onDragOver={(e) => {
                handleDragOver(e, "album");
                setIsHoveringAlbumTarget(true);
              }}
              onDragLeave={handleDragLeave}
              className={`relative w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer select-none border ${
                dragOverTarget === "album" || isHoveringAlbumTarget
                  ? "bg-primary text-on-primary border-primary scale-110 shadow-xl shadow-primary/40 ring-2 ring-primary/50"
                  : "bg-surface-base border-outline-variant/40 text-primary hover:bg-surface-container hover:scale-105 shadow-lg shadow-black/10 dark:shadow-black/40"
              }`}
              title="Add to Album (Drop here)"
            >
              <motion.div
                variants={iconVariants}
                className="flex items-center justify-center pointer-events-none"
              >
                <FolderPlus
                  className={`w-8 h-8 sm:w-9 sm:h-9 ${
                    dragOverTarget === "album" || isHoveringAlbumTarget
                      ? "text-on-primary"
                      : "text-primary"
                  }`}
                  strokeWidth={2.2}
                />
              </motion.div>
            </motion.div>

            {/* Droplet 2: Star / Favorite */}
            <motion.div
              variants={dropletBodyVariants}
              onDragOver={(e) => {
                handleDragOver(e, "favorite");
                setIsHoveringAlbumTarget(false);
              }}
              onDragLeave={handleDragLeave}
              onDrop={handleDropFavorite}
              className={`relative w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer select-none border ${
                dragOverTarget === "favorite"
                  ? "bg-amber-500 text-white border-amber-400 scale-110 shadow-xl shadow-amber-500/40 ring-2 ring-amber-400/50"
                  : "bg-surface-base border-outline-variant/40 text-amber-500 hover:bg-surface-container hover:scale-105 shadow-lg shadow-black/10 dark:shadow-black/40"
              }`}
              title="Add to Favorites (Drop here)"
            >
              <motion.div
                variants={iconVariants}
                className="flex items-center justify-center pointer-events-none"
              >
                <Star
                  className={`w-8 h-8 sm:w-9 sm:h-9 ${
                    dragOverTarget === "favorite"
                      ? "fill-white text-white"
                      : "fill-amber-400 text-amber-500"
                  }`}
                  strokeWidth={2.2}
                />
              </motion.div>
            </motion.div>

            {/* Droplet 3: Trash / Delete */}
            <motion.div
              variants={dropletBodyVariants}
              onDragOver={(e) => {
                handleDragOver(e, "trash");
                setIsHoveringAlbumTarget(false);
              }}
              onDragLeave={handleDragLeave}
              onDrop={handleDropTrash}
              className={`relative w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer select-none border ${
                dragOverTarget === "trash"
                  ? "bg-error text-on-error border-error scale-110 shadow-xl shadow-error/40 ring-2 ring-error/50"
                  : "bg-surface-base border-outline-variant/40 text-error hover:bg-surface-container hover:scale-105 shadow-lg shadow-black/10 dark:shadow-black/40"
              }`}
              title="Delete Selected (Drop here)"
            >
              <motion.div
                variants={iconVariants}
                className="flex items-center justify-center pointer-events-none"
              >
                <Trash2
                  className={`w-8 h-8 sm:w-9 sm:h-9 ${
                    dragOverTarget === "trash" ? "text-on-error" : "text-error"
                  }`}
                  strokeWidth={2.2}
                />
              </motion.div>
            </motion.div>

            {/* Droplet 4: Deselect / Cancel */}
            <motion.div
              variants={dropletBodyVariants}
              onDragOver={(e) => {
                handleDragOver(e, "deselect");
                setIsHoveringAlbumTarget(false);
              }}
              onDragLeave={handleDragLeave}
              onDrop={handleDropDeselect}
              className={`relative w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer select-none border ${
                dragOverTarget === "deselect"
                  ? "bg-surface-container-highest text-on-surface border-outline scale-110 shadow-md"
                  : "bg-surface-base border-outline-variant/40 text-on-surface-variant hover:text-on-surface hover:bg-surface-container hover:scale-105 shadow-lg shadow-black/10 dark:shadow-black/40"
              }`}
              title="Cancel Selection (Drop here)"
            >
              <motion.div
                variants={iconVariants}
                className="flex items-center justify-center pointer-events-none"
              >
                <X
                  className={`w-8 h-8 sm:w-9 sm:h-9 ${
                    dragOverTarget === "deselect"
                      ? "text-on-surface"
                      : "text-on-surface-variant"
                  }`}
                  strokeWidth={2.2}
                />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
