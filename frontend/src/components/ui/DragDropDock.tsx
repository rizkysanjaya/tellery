/**
 * =============================================================================
 * Module: frontend/src/components/ui/DragDropDock.tsx
 * Purpose: Bottom action dock with individual solid-themed circular drop targets
 *          featuring authentic gooey liquid SVG filter physics:
 *          - Liquid base anchor bead stretching a viscous fluid bridge to rising droplet
 *          - Snapping surface tension at peak apex followed by fluid squash and settle
 *          - Staggered in left-to-right order (Add to Album -> Favorite -> Delete -> Cancel)
 *          - Razor-sharp unblurred icons rendered on top of gooey liquid layer
 *          - Enlarged prominent icons with generous spacing margin
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
      staggerChildren: 0.12, // Distinct left-to-right cascade wave
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

// Outer droplet item wrapper
const dropletItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.25 },
  },
};

// Base liquid reservoir anchor bead
const gooeyBaseVariants: Variants = {
  hidden: {
    y: 65,
    scale: 1,
    opacity: 0.9,
  },
  visible: {
    y: [65, 62, 58, 55],
    scale: [1, 0.85, 0.4, 0],
    opacity: [0.9, 0.9, 0.6, 0],
    transition: {
      duration: 0.52,
      times: [0, 0.35, 0.7, 1],
      ease: "easeInOut",
    },
  },
  exit: {
    scale: 0,
    opacity: 0,
  },
};

// Rising head droplet that stretches into an oval and snaps free
const gooeyHeadVariants: Variants = {
  hidden: {
    y: 80,
    scaleX: 0.4,
    scaleY: 0.4,
    opacity: 0,
  },
  visible: {
    opacity: [0, 1, 1, 1, 1],
    y: [80, 28, -14, 4, 0],
    scaleX: [0.4, 0.68, 1.25, 0.94, 1],
    scaleY: [0.4, 1.55, 0.8, 1.08, 1],
    transition: {
      duration: 0.68,
      times: [0, 0.38, 0.7, 0.88, 1],
      ease: ["easeInOut", "easeOut", "easeInOut", "easeOut"],
    },
  },
  exit: {
    y: [0, -10, 85],
    scaleX: [1, 0.7, 0.2],
    scaleY: [1, 1.45, 0.2],
    opacity: [1, 1, 0],
    transition: {
      duration: 0.32,
      times: [0, 0.3, 1],
      ease: "easeInOut",
    },
  },
};

// Razor-sharp icon layer that emerges as the droplet forms
const iconVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.3,
    y: 35,
  },
  visible: {
    opacity: [0, 0, 1, 1],
    scale: [0.3, 0.5, 1.15, 1],
    y: [35, 12, -3, 0],
    transition: {
      duration: 0.68,
      times: [0, 0.45, 0.8, 1],
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    scale: 0.3,
    y: 25,
    transition: { duration: 0.2 },
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
          {/* Hidden W3C SVG Gooey Liquid Filter Definition */}
          <svg
            className="absolute w-0 h-0 pointer-events-none opacity-0"
            style={{ position: "absolute", width: 0, height: 0 }}
            aria-hidden="true"
          >
            <defs>
              <filter id="dock-gooey" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
                <feColorMatrix
                  in="blur"
                  mode="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
                  result="goo"
                />
                <feComposite in="SourceGraphic" in2="goo" operator="atop" />
              </filter>
            </defs>
          </svg>

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

          {/* Individual Solid Theme Gooey Liquid Droplet Circles (No wrapping box; Left-to-Right Droplet Stagger) */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex items-center gap-6 sm:gap-8 pointer-events-auto"
          >
            {/* Droplet 1: Add to Album (FolderPlus) */}
            <motion.div
              variants={dropletItemVariants}
              onDragOver={(e) => {
                handleDragOver(e, "album");
                setIsHoveringAlbumTarget(true);
              }}
              onDragLeave={handleDragLeave}
              className="relative w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] flex items-center justify-center cursor-pointer select-none group/droplet"
              title="Add to Album (Drop here)"
            >
              {/* Gooey Liquid Morphing Layer */}
              <div
                className="absolute -inset-4 flex items-center justify-center pointer-events-none"
                style={{ filter: "url(#dock-gooey)" }}
              >
                <motion.div
                  variants={gooeyBaseVariants}
                  className={`absolute w-12 h-12 rounded-full transition-colors duration-200 ${
                    dragOverTarget === "album" || isHoveringAlbumTarget
                      ? "bg-primary"
                      : "bg-surface-base"
                  }`}
                />
                <motion.div
                  variants={gooeyHeadVariants}
                  className={`w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full transition-all duration-200 ${
                    dragOverTarget === "album" || isHoveringAlbumTarget
                      ? "bg-primary"
                      : "bg-surface-base"
                  }`}
                />
              </div>

              {/* Crisp Border & Raised Shadow Frame */}
              <motion.div
                variants={gooeyHeadVariants}
                className={`absolute inset-0 rounded-full border pointer-events-none transition-all duration-200 ${
                  dragOverTarget === "album" || isHoveringAlbumTarget
                    ? "border-primary shadow-xl shadow-primary/40 ring-2 ring-primary/50"
                    : "border-outline-variant/40 shadow-lg shadow-black/10 dark:shadow-black/40 group-hover/droplet:border-primary/60"
                }`}
              />

              {/* Razor-Sharp Icon Layer */}
              <motion.div
                variants={iconVariants}
                className="relative z-10 flex items-center justify-center pointer-events-none"
              >
                <FolderPlus
                  className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors ${
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
              variants={dropletItemVariants}
              onDragOver={(e) => {
                handleDragOver(e, "favorite");
                setIsHoveringAlbumTarget(false);
              }}
              onDragLeave={handleDragLeave}
              onDrop={handleDropFavorite}
              className="relative w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] flex items-center justify-center cursor-pointer select-none group/droplet"
              title="Add to Favorites (Drop here)"
            >
              {/* Gooey Liquid Morphing Layer */}
              <div
                className="absolute -inset-4 flex items-center justify-center pointer-events-none"
                style={{ filter: "url(#dock-gooey)" }}
              >
                <motion.div
                  variants={gooeyBaseVariants}
                  className={`absolute w-12 h-12 rounded-full transition-colors duration-200 ${
                    dragOverTarget === "favorite"
                      ? "bg-amber-500"
                      : "bg-surface-base"
                  }`}
                />
                <motion.div
                  variants={gooeyHeadVariants}
                  className={`w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full transition-all duration-200 ${
                    dragOverTarget === "favorite"
                      ? "bg-amber-500"
                      : "bg-surface-base"
                  }`}
                />
              </div>

              {/* Crisp Border & Raised Shadow Frame */}
              <motion.div
                variants={gooeyHeadVariants}
                className={`absolute inset-0 rounded-full border pointer-events-none transition-all duration-200 ${
                  dragOverTarget === "favorite"
                    ? "border-amber-400 shadow-xl shadow-amber-500/40 ring-2 ring-amber-400/50"
                    : "border-outline-variant/40 shadow-lg shadow-black/10 dark:shadow-black/40 group-hover/droplet:border-amber-400/60"
                }`}
              />

              {/* Razor-Sharp Icon Layer */}
              <motion.div
                variants={iconVariants}
                className="relative z-10 flex items-center justify-center pointer-events-none"
              >
                <Star
                  className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors ${
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
              variants={dropletItemVariants}
              onDragOver={(e) => {
                handleDragOver(e, "trash");
                setIsHoveringAlbumTarget(false);
              }}
              onDragLeave={handleDragLeave}
              onDrop={handleDropTrash}
              className="relative w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] flex items-center justify-center cursor-pointer select-none group/droplet"
              title="Delete Selected (Drop here)"
            >
              {/* Gooey Liquid Morphing Layer */}
              <div
                className="absolute -inset-4 flex items-center justify-center pointer-events-none"
                style={{ filter: "url(#dock-gooey)" }}
              >
                <motion.div
                  variants={gooeyBaseVariants}
                  className={`absolute w-12 h-12 rounded-full transition-colors duration-200 ${
                    dragOverTarget === "trash"
                      ? "bg-error"
                      : "bg-surface-base"
                  }`}
                />
                <motion.div
                  variants={gooeyHeadVariants}
                  className={`w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full transition-all duration-200 ${
                    dragOverTarget === "trash"
                      ? "bg-error"
                      : "bg-surface-base"
                  }`}
                />
              </div>

              {/* Crisp Border & Raised Shadow Frame */}
              <motion.div
                variants={gooeyHeadVariants}
                className={`absolute inset-0 rounded-full border pointer-events-none transition-all duration-200 ${
                  dragOverTarget === "trash"
                    ? "border-error shadow-xl shadow-error/40 ring-2 ring-error/50"
                    : "border-outline-variant/40 shadow-lg shadow-black/10 dark:shadow-black/40 group-hover/droplet:border-error/60"
                }`}
              />

              {/* Razor-Sharp Icon Layer */}
              <motion.div
                variants={iconVariants}
                className="relative z-10 flex items-center justify-center pointer-events-none"
              >
                <Trash2
                  className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors ${
                    dragOverTarget === "trash"
                      ? "text-on-error"
                      : "text-error"
                  }`}
                  strokeWidth={2.2}
                />
              </motion.div>
            </motion.div>

            {/* Droplet 4: Deselect / Cancel */}
            <motion.div
              variants={dropletItemVariants}
              onDragOver={(e) => {
                handleDragOver(e, "deselect");
                setIsHoveringAlbumTarget(false);
              }}
              onDragLeave={handleDragLeave}
              onDrop={handleDropDeselect}
              className="relative w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] flex items-center justify-center cursor-pointer select-none group/droplet"
              title="Cancel Selection (Drop here)"
            >
              {/* Gooey Liquid Morphing Layer */}
              <div
                className="absolute -inset-4 flex items-center justify-center pointer-events-none"
                style={{ filter: "url(#dock-gooey)" }}
              >
                <motion.div
                  variants={gooeyBaseVariants}
                  className={`absolute w-12 h-12 rounded-full transition-colors duration-200 ${
                    dragOverTarget === "deselect"
                      ? "bg-surface-container-highest"
                      : "bg-surface-base"
                  }`}
                />
                <motion.div
                  variants={gooeyHeadVariants}
                  className={`w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full transition-all duration-200 ${
                    dragOverTarget === "deselect"
                      ? "bg-surface-container-highest"
                      : "bg-surface-base"
                  }`}
                />
              </div>

              {/* Crisp Border & Raised Shadow Frame */}
              <motion.div
                variants={gooeyHeadVariants}
                className={`absolute inset-0 rounded-full border pointer-events-none transition-all duration-200 ${
                  dragOverTarget === "deselect"
                    ? "border-outline shadow-md ring-2 ring-outline/40"
                    : "border-outline-variant/40 shadow-lg shadow-black/10 dark:shadow-black/40 group-hover/droplet:border-outline-variant/70"
                }`}
              />

              {/* Razor-Sharp Icon Layer */}
              <motion.div
                variants={iconVariants}
                className="relative z-10 flex items-center justify-center pointer-events-none"
              >
                <X
                  className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors ${
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
