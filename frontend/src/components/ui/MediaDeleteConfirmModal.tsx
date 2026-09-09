/**
 * =============================================================================
 * Module: frontend/src/components/ui/MediaDeleteConfirmModal.tsx
 * Purpose: Precision confirmation dialog before deleting one or multiple media items.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: MediaDeleteConfirmModal
 * Side Effects: Calls onConfirm or onCancel callback upon user action.
 * =============================================================================
 */

import React, { useEffect } from "react";
import { Trash2, X } from "lucide-react";
import { MediaItem } from "../../types";

interface MediaDeleteConfirmModalProps {
  isOpen: boolean;
  items: MediaItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const MediaDeleteConfirmModal: React.FC<MediaDeleteConfirmModalProps> = ({
  isOpen,
  items,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      } else if (e.key === "Enter") {
        onConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen || items.length === 0) return null;

  const count = items.length;
  const isSingle = count === 1;
  const singleItem = items[0];

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container-low/95 backdrop-blur-md border border-outline-variant/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-150 relative select-none"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06] transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-on-surface">
              {isSingle ? "Delete Media File?" : `Delete ${count} Items?`}
            </h3>
            <p className="text-[11px] text-on-surface-variant">
              This will remove the media from your vault.
            </p>
          </div>
        </div>

        {/* Content Info */}
        <div className="my-4 p-3.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/15 text-xs text-on-surface-variant leading-relaxed">
          {isSingle ? (
            <p>
              Are you sure you want to delete{" "}
              <span className="text-on-surface font-semibold break-all">
                "{singleItem.file_name}"
              </span>
              ? You will have a 10-second undo window after confirming.
            </p>
          ) : (
            <p>
              Are you sure you want to delete{" "}
              <span className="text-on-surface font-semibold">{count} selected items</span>
              ? You will have a 10-second undo window after confirming.
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
};
