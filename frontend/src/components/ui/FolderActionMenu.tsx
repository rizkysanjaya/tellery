/**
 * =============================================================================
 * Module: frontend/src/components/ui/FolderActionMenu.tsx
 * Purpose: 3-dots context menu for albums and collections offering Customize Icon/Color,
 *          Change Cover Thumbnail, Rename, Move to Collection submenu, Favorite, Export as .ZIP, and Delete options.
 *          Uses React Portal (document.body) for fixed positioning to prevent CSS transform displacement.
 * Used by: Sidebar.tsx, FolderGrid.tsx
 * Dependencies: React, react-dom, lucide-react, FolderItem
 * Public Members: FolderActionMenu
 * Side Effects: Dispatches action callbacks to parent and handles outside clicks and scroll listener.
 * =============================================================================
 */

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  MoreVertical,
  Palette,
  Edit2,
  Star,
  Trash2,
  FolderInput,
  ChevronRight,
  ChevronDown,
  Layers,
  Check,
  Download,
} from "lucide-react";
import { FolderItem } from "../../types";

interface FolderActionMenuProps {
  folder: FolderItem;
  collections?: FolderItem[];
  onCustomize: (folder: FolderItem) => void;
  onSelectCover?: (folder: FolderItem) => void;
  onRename: (folder: FolderItem) => void;
  onToggleFavorite: (folder: FolderItem) => void;
  onExportZip?: (folder: FolderItem) => void;
  onDelete: (folder: FolderItem) => void;
  onMoveToCollection?: (folder: FolderItem, collectionId: number | null) => void;
  onOpenMoveModal?: (folder: FolderItem) => void;
  className?: string;
  triggerClassName?: string;
  align?: "left" | "right";
  placement?: "bottom" | "right";
}

export const FolderActionMenu: React.FC<FolderActionMenuProps> = ({
  folder,
  collections = [],
  onCustomize,
  onSelectCover,
  onRename,
  onToggleFavorite,
  onExportZip,
  onDelete,
  onMoveToCollection,
  onOpenMoveModal,
  className = "",
  triggerClassName = "",
  align = "right",
  placement = "bottom",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCollectionsSubmenu, setShowCollectionsSubmenu] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const calculateCoords = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuWidth = 224; // w-56 is 14rem = 224px
    const estimatedHeight = 280;

    let top: number;
    let left: number;

    if (placement === "right") {
      // Flyout to the right of the trigger (used in sidebar)
      left = Math.min(rect.right + 6, window.innerWidth - menuWidth - 12);
      top = Math.max(12, Math.min(rect.top - 4, window.innerHeight - estimatedHeight - 12));
    } else {
      // Standard bottom placement
      left =
        align === "left"
          ? Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 12))
          : Math.max(12, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 12));

      // If space below fits, open downwards; otherwise open upwards
      if (rect.bottom + estimatedHeight + 12 <= window.innerHeight) {
        top = rect.bottom + 4;
      } else {
        top = Math.max(12, rect.top - estimatedHeight - 4);
      }
    }

    setMenuCoords({ top, left });
  };

  // Close when any other folder action menu opens across the app
  useEffect(() => {
    const handleCloseOthers = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail !== folder.id) {
        setIsOpen(false);
        setShowCollectionsSubmenu(false);
      }
    };
    window.addEventListener("close-folder-action-menus", handleCloseOthers);
    return () => {
      window.removeEventListener("close-folder-action-menus", handleCloseOthers);
    };
  }, [folder.id]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false);
        setShowCollectionsSubmenu(false);
      }
    };

    const handleScrollOrResize = () => {
      if (isOpen) {
        setIsOpen(false);
        setShowCollectionsSubmenu(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick, true);
      document.addEventListener("pointerdown", handleOutsideClick, true);
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick, true);
      document.removeEventListener("pointerdown", handleOutsideClick, true);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  const isCollection = folder.is_collection;

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        draggable={false}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          if (!isOpen) {
            window.dispatchEvent(
              new CustomEvent("close-folder-action-menus", { detail: folder.id })
            );
            calculateCoords();
            setIsOpen(true);
          } else {
            setIsOpen(false);
          }
          setShowCollectionsSubmenu(false);
        }}
        className={`p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container active:scale-95 transition-all cursor-pointer ${triggerClassName}`}
        title={isCollection ? "Collection options" : "Album options"}
        aria-label={isCollection ? "Collection options" : "Album options"}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen &&
        menuCoords &&
        createPortal(
          <div
            ref={dropdownRef}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: `${menuCoords.top}px`,
              left: `${menuCoords.left}px`,
            }}
            className="w-56 py-1.5 rounded-2xl neo-card bg-surface-base border border-outline-variant/30 shadow-[0_16px_40px_rgba(0,0,0,0.45)] z-[99999] animate-in fade-in zoom-in-95 duration-150 text-xs select-none"
          >
            {/* Change Cover Thumbnail */}
            {onSelectCover && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onSelectCover(folder);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-on-surface hover:bg-surface-container-high hover:text-primary transition-colors cursor-pointer text-left"
              >
                <Palette className="w-3.5 h-3.5 text-on-surface-variant" />
                <span>Change Cover Thumbnail</span>
              </button>
            )}

            {/* Customize Icon & Color */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onCustomize(folder);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-on-surface hover:bg-surface-container-high hover:text-primary transition-colors cursor-pointer text-left"
            >
              <Palette className="w-3.5 h-3.5 text-on-surface-variant" />
              <span>Customize Icon & Color</span>
            </button>

            {/* Rename */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onRename(folder);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-on-surface hover:bg-surface-container-high hover:text-primary transition-colors cursor-pointer text-left"
            >
              <Edit2 className="w-3.5 h-3.5 text-on-surface-variant" />
              <span>{isCollection ? "Rename Collection" : "Rename Album"}</span>
            </button>

            {/* Favorite / Unfavorite (Only for standard albums) */}
            {!isCollection && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onToggleFavorite(folder);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer text-left"
              >
                <Star
                  className={`w-3.5 h-3.5 ${
                    folder.is_favorite ? "text-amber-400 fill-amber-400" : "text-on-surface-variant"
                  }`}
                />
                <span>{folder.is_favorite ? "Remove from Favorites" : "Add to Favorites"}</span>
              </button>
            )}

            {/* Move to Collection (Only for standard albums) */}
            {!isCollection && (onMoveToCollection || onOpenMoveModal) && (
              <div className="border-t border-outline-variant/15 my-1 pt-1">
                {onOpenMoveModal ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenMoveModal(folder);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      <FolderInput className="w-3.5 h-3.5 text-primary" />
                      <span className="font-medium">Move to Collection</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant" />
                  </button>
                ) : collections.length === 0 ? (
                  <div className="px-3 py-1.5 text-[11px] text-on-surface-variant/60 italic">
                    Create a collection first to move albums
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowCollectionsSubmenu((p) => !p)}
                      className="w-full flex items-center justify-between px-3 py-2 text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <FolderInput className="w-3.5 h-3.5 text-primary" />
                        <span className="font-medium">Move to Collection</span>
                      </div>
                      {showCollectionsSubmenu ? (
                        <ChevronDown className="w-3.5 h-3.5 text-on-surface-variant" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant" />
                      )}
                    </button>

                    {showCollectionsSubmenu && (
                      <div className="px-2 py-1.5 space-y-1 bg-surface-container/60 rounded-xl mx-2 my-1 border border-outline-variant/15">
                        {folder.parent_id && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              onMoveToCollection?.(folder, null);
                            }}
                            className="w-full text-left px-2 py-1.5 text-[11px] text-red-400 hover:bg-surface-container-high rounded-md flex items-center gap-1.5 font-medium transition-colors"
                          >
                            <span>✕ Ungroup (No Collection)</span>
                          </button>
                        )}
                        {collections
                          .filter((c) => c.id !== folder.id)
                          .map((col) => {
                            const isCurrent = folder.parent_id === col.id;
                            return (
                              <button
                                key={col.id}
                                type="button"
                                onClick={() => {
                                  setIsOpen(false);
                                  onMoveToCollection?.(folder, col.id);
                                }}
                                className={`w-full text-left px-2 py-1.5 text-[11px] rounded-md flex items-center justify-between transition-colors ${
                                  isCurrent
                                    ? "neo-pressed bg-surface-container-high text-primary font-bold"
                                    : "text-on-surface hover:bg-surface-container-high"
                                }`}
                              >
                                <div className="flex items-center gap-1.5 truncate pr-1">
                                  <Layers className="w-3 h-3 shrink-0 text-primary/70" />
                                  <span className="truncate">{col.name}</span>
                                </div>
                                {isCurrent && <Check className="w-3 h-3 shrink-0 text-primary" />}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Export Album as .ZIP */}
            {!isCollection && onExportZip && (
              <div className="border-t border-outline-variant/15 mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onExportZip(folder);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sky-400 hover:bg-sky-500/10 transition-colors cursor-pointer text-left"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export as .ZIP</span>
                </button>
              </div>
            )}

            {/* Delete Album / Collection */}
            <div className="border-t border-outline-variant/15 mt-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onDelete(folder);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isCollection ? "Delete Collection" : "Delete Album"}</span>
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
