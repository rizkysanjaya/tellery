/**
 * =============================================================================
 * Module: frontend/src/components/ui/DragDropDock.tsx
 * Purpose: Bottom action dock with individual solid-themed circular drop targets
 *          featuring authentic CodeShack-inspired liquid droplet animation physics:
 *          - Liquid droplet emerges from base pool, stretches with viscous surface tension,
 *            pinches, snaps at apex with liquid elasticity, and settles into a perfect sphere
 *          - 100% Pure CSS hardware-composited keyframes running on GPU thread (locked 60-120fps)
 *          - Rapid, fluid left-to-right cascade (440ms duration, 45ms stagger)
 *          - Static un-animated horizontal centering wrapper (prevents rightward shift)
 *          - Generous unclipped filter bounding box (prevents cutoff circles)
 *          - Robust drag-bridge and debounce timer for album popup (prevents list disappearing)
 *          - Action icons appear strictly AFTER the liquid neck snaps and circle settles
 *          - Fast, crisp dismissal on exit
 *          - Enlarged icons with generous spacing margin
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, framer-motion, frontend/src/types.ts, FolderIcon
 * Public Members: DragDropDock
 * Side Effects: Dispatches bulk delete prompt, album assignments, favorite toggling, and deselect on drop.
 * =============================================================================
 */

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const closeAlbumTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Filter out standalone albums and collection child albums
  const availableAlbums = folders.filter((f) => !f.is_collection);

  const scheduleCloseAlbum = (delayMs = 350) => {
    if (closeAlbumTimeoutRef.current) clearTimeout(closeAlbumTimeoutRef.current);
    closeAlbumTimeoutRef.current = setTimeout(() => {
      setIsHoveringAlbumTarget(false);
    }, delayMs);
  };

  const cancelCloseAlbum = () => {
    if (closeAlbumTimeoutRef.current) {
      clearTimeout(closeAlbumTimeoutRef.current);
      closeAlbumTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (closeAlbumTimeoutRef.current) {
        clearTimeout(closeAlbumTimeoutRef.current);
      }
    };
  }, []);

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
    cancelCloseAlbum();
    setIsHoveringAlbumTarget(false);
    onDropTrash(draggedMediaIds);
  };

  const handleDropFavorite = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    cancelCloseAlbum();
    setIsHoveringAlbumTarget(false);
    onDropFavorite(draggedMediaIds);
  };

  const handleDropDeselect = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    cancelCloseAlbum();
    setIsHoveringAlbumTarget(false);
    onDropDeselect();
  };

  const handleDropSpecificAlbum = (e: React.DragEvent, folderId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);
    cancelCloseAlbum();
    setIsHoveringAlbumTarget(false);
    onDropAlbum(folderId, draggedMediaIds);
  };

  const handleDropMainAlbum = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (availableAlbums.length === 1) {
      handleDropSpecificAlbum(e, availableAlbums[0].id);
    } else {
      cancelCloseAlbum();
      setIsHoveringAlbumTarget(true);
    }
  };

  return (
    <>
      {/* CodeShack Pure SVG Liquid Droplet Gooey Filter with Unclipped Bounds */}
      <svg
        className="fixed -left-[9999px] -top-[9999px] pointer-events-none w-0 h-0"
        aria-hidden="true"
      >
        <defs>
          <filter id="dock-liquid-droplet-filter" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            />
          </filter>
        </defs>
      </svg>

      {/* Static Un-animated Fixed Outer Shell: Always perfectly centered horizontally */}
      <div className="fixed bottom-7 left-1/2 -translate-x-1/2 z-[9990] flex flex-col items-center pointer-events-none select-none">
        <AnimatePresence>
          {isVisible && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15, transition: { duration: 0.15 } }}
              className="flex flex-col items-center pointer-events-auto"
            >
              {/* Expandable Album Selection Grid Popup */}
              <AnimatePresence>
                {isHoveringAlbumTarget && availableAlbums.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 25, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 25, scale: 0.94 }}
                    transition={{ type: "spring", stiffness: 420, damping: 28 }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      cancelCloseAlbum();
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      cancelCloseAlbum();
                      setIsHoveringAlbumTarget(true);
                    }}
                    onDragLeave={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        scheduleCloseAlbum(350);
                      }
                    }}
                    className="relative mb-3 w-[340px] sm:w-[420px] max-h-72 overflow-y-auto bg-surface-base/95 backdrop-blur-xl border border-outline-variant/30 rounded-neo-2xl p-3 shadow-2xl shadow-black/30 dark:shadow-black/70 flex flex-col gap-2 z-30 pointer-events-auto"
                  >
                    {/* Invisible Drag Bridge connecting popup to dock */}
                    <div
                      className="absolute -bottom-4 left-0 right-0 h-4 pointer-events-auto"
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        cancelCloseAlbum();
                      }}
                    />

                    <div className="flex items-center justify-between px-2 py-1 text-xs font-semibold text-on-surface-variant border-b border-outline-variant/15">
                      <div className="flex items-center gap-1.5">
                        <FolderPlus className="w-3.5 h-3.5 text-primary" />
                        <span>Select Target Album</span>
                      </div>
                      <button
                        onClick={() => {
                          cancelCloseAlbum();
                          setIsHoveringAlbumTarget(false);
                        }}
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
                            onDragEnter={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              cancelCloseAlbum();
                              setDragOverTarget(`album-${album.id}`);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              cancelCloseAlbum();
                              setDragOverTarget(`album-${album.id}`);
                            }}
                            onDragLeave={() => {
                              if (dragOverTarget === `album-${album.id}`) {
                                setDragOverTarget(null);
                              }
                            }}
                            onDrop={(e) => handleDropSpecificAlbum(e, album.id)}
                            className={`flex items-center gap-2.5 p-2 rounded-neo transition-all duration-150 cursor-pointer border ${
                              isTarget
                                ? "bg-primary/20 border-primary text-primary scale-[1.02] shadow-sm ring-2 ring-primary/40"
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
              <div className="flex items-center gap-6 sm:gap-8 pointer-events-auto">
                {/* Droplet 1: Add to Album (FolderPlus) */}
                <div
                  onDragEnter={(e) => {
                    e.preventDefault();
                    cancelCloseAlbum();
                    setIsHoveringAlbumTarget(true);
                  }}
                  onDragOver={(e) => {
                    handleDragOver(e, "album");
                    cancelCloseAlbum();
                    setIsHoveringAlbumTarget(true);
                  }}
                  onDragLeave={(e) => {
                    handleDragLeave(e);
                    scheduleCloseAlbum(400);
                  }}
                  onDrop={handleDropMainAlbum}
                  onClick={() => {
                    cancelCloseAlbum();
                    setIsHoveringAlbumTarget((prev) => !prev);
                  }}
                  className="relative w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] flex items-center justify-center cursor-pointer select-none group/droplet"
                  title="Add to Album (Drop here)"
                >
                  {/* Liquid Gooey Morphing Layer (Unclipped generous boundary) */}
                  <div
                    className="absolute -inset-8 flex items-center justify-center pointer-events-none overflow-visible"
                    style={{ filter: "url(#dock-liquid-droplet-filter)" }}
                  >
                    <div
                      className={`absolute bottom-1 w-12 h-6 rounded-full animate-dock-droplet-base ${
                        dragOverTarget === "album" || isHoveringAlbumTarget
                          ? "bg-primary"
                          : "bg-surface-base"
                      }`}
                      style={{ animationDelay: "0ms" }}
                    />
                    <div
                      className={`w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full animate-dock-droplet-rise transition-transform duration-150 ${
                        dragOverTarget === "album" || isHoveringAlbumTarget
                          ? "bg-primary scale-110"
                          : "bg-surface-base group-hover/droplet:bg-surface-container"
                      }`}
                      style={{ animationDelay: "0ms" }}
                    />
                  </div>

                  {/* Crisp Border & Raised Shadow Frame */}
                  <div
                    className={`absolute inset-0 rounded-full border pointer-events-none animate-dock-border-fade transition-all duration-150 ${
                      dragOverTarget === "album" || isHoveringAlbumTarget
                        ? "border-primary scale-110 shadow-xl shadow-primary/40 ring-2 ring-primary/50"
                        : "border-outline-variant/40 shadow-lg shadow-black/10 dark:shadow-black/40 group-hover/droplet:border-primary/60 group-hover/droplet:scale-105"
                    }`}
                    style={{ animationDelay: "0ms" }}
                  />

                  {/* Razor-Sharp Action Icon */}
                  <div
                    className="relative z-10 flex items-center justify-center pointer-events-none animate-dock-icon-pop"
                    style={{ animationDelay: "0ms" }}
                  >
                    <FolderPlus
                      className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors duration-150 ${
                        dragOverTarget === "album" || isHoveringAlbumTarget
                          ? "text-on-primary"
                          : "text-primary"
                      }`}
                      strokeWidth={2.2}
                    />
                  </div>
                </div>

                {/* Droplet 2: Star / Favorite */}
                <div
                  onDragEnter={() => scheduleCloseAlbum(0)}
                  onDragOver={(e) => {
                    handleDragOver(e, "favorite");
                    scheduleCloseAlbum(0);
                  }}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDropFavorite}
                  className="relative w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] flex items-center justify-center cursor-pointer select-none group/droplet"
                  title="Add to Favorites (Drop here)"
                >
                  {/* Liquid Gooey Morphing Layer (Unclipped generous boundary) */}
                  <div
                    className="absolute -inset-8 flex items-center justify-center pointer-events-none overflow-visible"
                    style={{ filter: "url(#dock-liquid-droplet-filter)" }}
                  >
                    <div
                      className={`absolute bottom-1 w-12 h-6 rounded-full animate-dock-droplet-base ${
                        dragOverTarget === "favorite"
                          ? "bg-amber-500"
                          : "bg-surface-base"
                      }`}
                      style={{ animationDelay: "45ms" }}
                    />
                    <div
                      className={`w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full animate-dock-droplet-rise transition-all duration-150 ${
                        dragOverTarget === "favorite"
                          ? "bg-amber-500 scale-110"
                          : "bg-surface-base group-hover/droplet:bg-surface-container"
                      }`}
                      style={{ animationDelay: "45ms" }}
                    />
                  </div>

                  {/* Crisp Border & Raised Shadow Frame */}
                  <div
                    className={`absolute inset-0 rounded-full border pointer-events-none animate-dock-border-fade transition-all duration-150 ${
                      dragOverTarget === "favorite"
                        ? "border-amber-400 scale-110 shadow-xl shadow-amber-500/40 ring-2 ring-amber-400/50"
                        : "border-outline-variant/40 shadow-lg shadow-black/10 dark:shadow-black/40 group-hover/droplet:border-amber-400/60 group-hover/droplet:scale-105"
                    }`}
                    style={{ animationDelay: "45ms" }}
                  />

                  {/* Razor-Sharp Action Icon */}
                  <div
                    className="relative z-10 flex items-center justify-center pointer-events-none animate-dock-icon-pop"
                    style={{ animationDelay: "45ms" }}
                  >
                    <Star
                      className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors duration-150 ${
                        dragOverTarget === "favorite"
                          ? "fill-white text-white"
                          : "fill-amber-400 text-amber-500"
                      }`}
                      strokeWidth={2.2}
                    />
                  </div>
                </div>

                {/* Droplet 3: Trash / Delete */}
                <div
                  onDragEnter={() => scheduleCloseAlbum(0)}
                  onDragOver={(e) => {
                    handleDragOver(e, "trash");
                    scheduleCloseAlbum(0);
                  }}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDropTrash}
                  className="relative w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] flex items-center justify-center cursor-pointer select-none group/droplet"
                  title="Delete Selected (Drop here)"
                >
                  {/* Liquid Gooey Morphing Layer (Unclipped generous boundary) */}
                  <div
                    className="absolute -inset-8 flex items-center justify-center pointer-events-none overflow-visible"
                    style={{ filter: "url(#dock-liquid-droplet-filter)" }}
                  >
                    <div
                      className={`absolute bottom-1 w-12 h-6 rounded-full animate-dock-droplet-base ${
                        dragOverTarget === "trash"
                          ? "bg-error"
                          : "bg-surface-base"
                      }`}
                      style={{ animationDelay: "90ms" }}
                    />
                    <div
                      className={`w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full animate-dock-droplet-rise transition-all duration-150 ${
                        dragOverTarget === "trash"
                          ? "bg-error scale-110"
                          : "bg-surface-base group-hover/droplet:bg-surface-container"
                      }`}
                      style={{ animationDelay: "90ms" }}
                    />
                  </div>

                  {/* Crisp Border & Raised Shadow Frame */}
                  <div
                    className={`absolute inset-0 rounded-full border pointer-events-none animate-dock-border-fade transition-all duration-150 ${
                      dragOverTarget === "trash"
                        ? "border-error scale-110 shadow-xl shadow-error/40 ring-2 ring-error/50"
                        : "border-outline-variant/40 shadow-lg shadow-black/10 dark:shadow-black/40 group-hover/droplet:border-error/60 group-hover/droplet:scale-105"
                    }`}
                    style={{ animationDelay: "90ms" }}
                  />

                  {/* Razor-Sharp Action Icon */}
                  <div
                    className="relative z-10 flex items-center justify-center pointer-events-none animate-dock-icon-pop"
                    style={{ animationDelay: "90ms" }}
                  >
                    <Trash2
                      className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors duration-150 ${
                        dragOverTarget === "trash" ? "text-on-error" : "text-error"
                      }`}
                      strokeWidth={2.2}
                    />
                  </div>
                </div>

                {/* Droplet 4: Deselect / Cancel */}
                <div
                  onDragEnter={() => scheduleCloseAlbum(0)}
                  onDragOver={(e) => {
                    handleDragOver(e, "deselect");
                    scheduleCloseAlbum(0);
                  }}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDropDeselect}
                  className="relative w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] flex items-center justify-center cursor-pointer select-none group/droplet"
                  title="Cancel Selection (Drop here)"
                >
                  {/* Liquid Gooey Morphing Layer (Unclipped generous boundary) */}
                  <div
                    className="absolute -inset-8 flex items-center justify-center pointer-events-none overflow-visible"
                    style={{ filter: "url(#dock-liquid-droplet-filter)" }}
                  >
                    <div
                      className={`absolute bottom-1 w-12 h-6 rounded-full animate-dock-droplet-base ${
                        dragOverTarget === "deselect"
                          ? "bg-surface-container-highest"
                          : "bg-surface-base"
                      }`}
                      style={{ animationDelay: "135ms" }}
                    />
                    <div
                      className={`w-16 h-16 sm:w-[4.5rem] sm:h-[4.5rem] rounded-full animate-dock-droplet-rise transition-all duration-150 ${
                        dragOverTarget === "deselect"
                          ? "bg-surface-container-highest scale-110"
                          : "bg-surface-base group-hover/droplet:bg-surface-container"
                      }`}
                      style={{ animationDelay: "135ms" }}
                    />
                  </div>

                  {/* Crisp Border & Raised Shadow Frame */}
                  <div
                    className={`absolute inset-0 rounded-full border pointer-events-none animate-dock-border-fade transition-all duration-150 ${
                      dragOverTarget === "deselect"
                        ? "border-outline scale-110 shadow-md ring-2 ring-outline/40"
                        : "border-outline-variant/40 shadow-lg shadow-black/10 dark:shadow-black/40 group-hover/droplet:border-outline-variant/70 group-hover/droplet:scale-105"
                    }`}
                    style={{ animationDelay: "135ms" }}
                  />

                  {/* Razor-Sharp Action Icon */}
                  <div
                    className="relative z-10 flex items-center justify-center pointer-events-none animate-dock-icon-pop"
                    style={{ animationDelay: "135ms" }}
                  >
                    <X
                      className={`w-8 h-8 sm:w-9 sm:h-9 transition-colors duration-150 ${
                        dragOverTarget === "deselect"
                          ? "text-on-surface"
                          : "text-on-surface-variant"
                      }`}
                      strokeWidth={2.2}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};
