/**
 * =============================================================================
 * Module: frontend/src/components/ui/FolderActionMenu.tsx
 * Purpose: 3-dots context menu for albums offering Customize, Rename, Favorite, and Delete options.
 * Used by: Sidebar.tsx, FolderGrid.tsx
 * Dependencies: React, lucide-react, FolderItem
 * Public Members: FolderActionMenu
 * Side Effects: Dispatches action callbacks to parent.
 * =============================================================================
 */

import React, { useState, useRef, useEffect } from "react";
import {
  MoreVertical,
  Palette,
  Edit2,
  Star,
  Trash2,
  FolderInput,
} from "lucide-react";
import { FolderItem } from "../../types";

interface FolderActionMenuProps {
  folder: FolderItem;
  collections?: FolderItem[];
  onCustomize: (folder: FolderItem) => void;
  onSelectCover?: (folder: FolderItem) => void;
  onRename: (folder: FolderItem) => void;
  onToggleFavorite: (folder: FolderItem) => void;
  onDelete: (folder: FolderItem) => void;
  onMoveToCollection?: (folder: FolderItem, collectionId: number | null) => void;
  className?: string;
  triggerClassName?: string;
  align?: "left" | "right";
}

export const FolderActionMenu: React.FC<FolderActionMenuProps> = ({
  folder,
  collections = [],
  onCustomize,
  onSelectCover,
  onRename,
  onToggleFavorite,
  onDelete,
  onMoveToCollection,
  className = "",
  triggerClassName = "",
  align = "right",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCollectionsSubmenu, setShowCollectionsSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowCollectionsSubmenu(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const alignClass = align === "left" ? "left-0" : "right-0";

  return (
    <div ref={menuRef} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
          setShowCollectionsSubmenu(false);
        }}
        className={`p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container active:scale-95 transition-all cursor-pointer ${triggerClassName}`}
        title="Album options"
        aria-label="Album options"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${alignClass} top-full mt-1 w-52 py-1.5 rounded-2xl neo-card bg-[#141d33] border border-outline-variant/30 shadow-[0_12px_36px_rgba(0,0,0,0.55)] z-50 animate-in fade-in zoom-in-95 duration-150 text-xs`}
        >
          {/* Change Cover Thumbnail */}
          {onSelectCover && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onSelectCover(folder);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-on-surface hover:bg-surface-base/80 hover:text-primary transition-colors cursor-pointer text-left"
            >
              <Palette className="w-3.5 h-3.5 text-primary" />
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
            className="w-full flex items-center gap-2.5 px-3 py-2 text-on-surface hover:bg-surface-base/80 hover:text-primary transition-colors cursor-pointer text-left"
          >
            <Palette className="w-3.5 h-3.5 text-on-surface-variant" />
            <span>Customize Icon & Color</span>
          </button>

          {/* Rename Album */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onRename(folder);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-on-surface hover:bg-surface-base/80 hover:text-primary transition-colors cursor-pointer text-left"
          >
            <Edit2 className="w-3.5 h-3.5 text-on-surface-variant" />
            <span>Rename Album</span>
          </button>

          {/* Favorite Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onToggleFavorite(folder);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-on-surface hover:bg-surface-base/80 transition-colors cursor-pointer text-left"
          >
            <Star
              className={`w-3.5 h-3.5 ${
                folder.is_favorite ? "text-amber-400 fill-amber-400" : "text-on-surface-variant"
              }`}
            />
            <span>{folder.is_favorite ? "Remove from Favorites" : "Add to Favorites"}</span>
          </button>

          {/* Move to Collection (Optional Submenu) */}
          {onMoveToCollection && collections.length > 0 && (
            <div className="relative border-t border-outline-variant/15 my-1 pt-1">
              <button
                type="button"
                onClick={() => setShowCollectionsSubmenu((p) => !p)}
                className="w-full flex items-center justify-between px-3 py-2 text-on-surface hover:bg-surface-base/80 transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2.5">
                  <FolderInput className="w-3.5 h-3.5 text-on-surface-variant" />
                  <span>Move to Collection</span>
                </div>
              </button>

              {showCollectionsSubmenu && (
                <div className="px-2 py-1 space-y-0.5 bg-surface-container/50 rounded-lg mx-2 my-1">
                  {folder.parent_id && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        onMoveToCollection(folder, null);
                      }}
                      className="w-full text-left px-2 py-1 text-[11px] text-red-400 hover:bg-surface-base rounded"
                    >
                      Ungroup (No Collection)
                    </button>
                  )}
                  {collections
                    .filter((c) => c.id !== folder.id)
                    .map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onMoveToCollection(folder, col.id);
                        }}
                        className={`w-full text-left px-2 py-1 text-[11px] rounded truncate hover:bg-surface-base ${
                          folder.parent_id === col.id ? "text-primary font-bold" : "text-on-surface"
                        }`}
                      >
                        {col.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Delete Album */}
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
              <span>Delete Album</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
