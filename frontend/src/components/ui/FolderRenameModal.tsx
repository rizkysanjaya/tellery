/**
 * =============================================================================
 * Module: frontend/src/components/ui/FolderRenameModal.tsx
 * Purpose: Neomorphic modal dialog for renaming an album with validation and duplicate prevention.
 * Used by: Sidebar.tsx, FolderGrid.tsx, App.tsx
 * Dependencies: React, lucide-react
 * Public Members: FolderRenameModal
 * Side Effects: Calls onRename callback with new name.
 * =============================================================================
 */

import React, { useState, useEffect } from "react";
import { X, Edit2 } from "lucide-react";
import { FolderItem } from "../../types";

interface FolderRenameModalProps {
  folder: FolderItem;
  isOpen: boolean;
  onClose: () => void;
  onRename: (folderId: number, newName: string) => Promise<void>;
}

export const FolderRenameModal: React.FC<FolderRenameModalProps> = ({
  folder,
  isOpen,
  onClose,
  onRename,
}) => {
  const [name, setName] = useState(folder.name);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(folder.name);
    setError(null);
  }, [folder]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError("Album name cannot be empty.");
      return;
    }
    if (clean.toLowerCase() === folder.name.toLowerCase()) {
      onClose();
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onRename(folder.id, clean);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to rename album.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div
        className="max-w-md w-full bg-surface-base border border-outline-variant/20 rounded-neo-xl p-6 neo-card shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
          <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-primary" />
            <span>Rename Album</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-neo text-on-surface-variant hover:text-on-surface neo-button"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5">
              Album Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Summer Trip 2026"
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-neo bg-surface-container text-sm text-on-surface placeholder:text-on-surface-variant outline-none border border-outline-variant/15 focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all font-medium"
            />
            {error && (
              <p className="text-xs text-red-400 mt-1.5 font-medium">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/15">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-on-surface-variant hover:text-on-surface rounded-neo neo-button cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 text-xs font-semibold neo-button-primary rounded-neo cursor-pointer transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Renaming..." : "Save Name"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
