/**
 * =============================================================================
 * Module: frontend/src/components/ui/FolderDeleteConfirmModal.tsx
 * Purpose: Neomorphic confirmation dialog before deleting an Album or Collection
 *          with clear explanations and protection against accidental deletion.
 * Used by: frontend/src/App.tsx, frontend/src/components/FolderGrid.tsx, frontend/src/components/Sidebar.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: FolderDeleteConfirmModal
 * Side Effects: Calls onConfirm or onCancel callback upon user action.
 * =============================================================================
 */

import React, { useEffect } from "react";
import { Trash2, X, AlertTriangle, Layers } from "lucide-react";
import { FolderItem } from "../../types";

interface FolderDeleteConfirmModalProps {
  isOpen: boolean;
  folder: FolderItem | null;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export const FolderDeleteConfirmModal: React.FC<FolderDeleteConfirmModalProps> = ({
  isOpen,
  folder,
  onConfirm,
  onCancel,
  isDeleting = false,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        onCancel();
      } else if (e.key === "Enter" && !isDeleting) {
        onConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDeleting, onCancel, onConfirm]);

  if (!isOpen || !folder) return null;

  const isCollection = folder.is_collection;
  const entityLabel = isCollection ? "Collection" : "Album";

  return (
    <div
      className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={() => {
        if (!isDeleting) onCancel();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="neo-card bg-surface-base border border-outline-variant/30 rounded-neo-xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-150 relative select-none"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isDeleting}
          className="absolute top-4 right-4 p-1 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer disabled:opacity-50"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-11 h-11 rounded-neo bg-red-500/10 text-red-400 flex items-center justify-center shrink-0 neo-pressed">
            {isCollection ? <Layers className="w-5 h-5 text-red-400" /> : <Trash2 className="w-5 h-5 text-red-400" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-on-surface">
              Delete {entityLabel}?
            </h3>
            <p className="text-xs text-on-surface-variant">
              This will remove the {entityLabel.toLowerCase()} organizer.
            </p>
          </div>
        </div>

        {/* Content Info */}
        <div className="my-4 p-3.5 rounded-neo-lg bg-surface-container/60 border border-outline-variant/15 text-xs text-on-surface-variant leading-relaxed space-y-2">
          <p>
            Are you sure you want to delete {entityLabel.toLowerCase()}{" "}
            <span className="text-on-surface font-bold break-all">"{folder.name}"</span>?
          </p>
          <div className="flex items-start gap-2 pt-1 text-[11px] text-on-surface-variant/80">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              {isCollection
                ? "Contained albums will become standalone albums. All photos and videos remain completely safe in your vault."
                : "Original photos and videos will remain completely safe in your cloud vault timeline."}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface neo-button rounded-neo transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-xs font-semibold text-white bg-error hover:bg-red-600 active:scale-95 rounded-neo shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {isDeleting ? "Deleting..." : `Delete ${entityLabel}`}
          </button>
        </div>
      </div>
    </div>
  );
};
