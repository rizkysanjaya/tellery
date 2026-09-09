/**
 * =============================================================================
 * Module: frontend/src/components/ui/FolderMoveModal.tsx
 * Purpose: Dedicated modal dialog for moving an album into a collection or ungrouping it.
 * Used by: Sidebar.tsx, FolderGrid.tsx
 * Dependencies: React, lucide-react, FolderItem
 * Public Members: FolderMoveModal
 * Side Effects: Calls onMove with target collection ID (or null for ungroup).
 * =============================================================================
 */

import React, { useState } from "react";
import { FolderInput, Layers, X, Check, Folder, Loader2 } from "lucide-react";
import { FolderItem } from "../../types";

interface FolderMoveModalProps {
  folder: FolderItem | null;
  collections: FolderItem[];
  isOpen: boolean;
  onClose: () => void;
  onMove: (folderId: number, collectionId: number | null) => Promise<void>;
}

export const FolderMoveModal: React.FC<FolderMoveModalProps> = ({
  folder,
  collections,
  isOpen,
  onClose,
  onMove,
}) => {
  const [selectedColId, setSelectedColId] = useState<number | null>(() => folder?.parent_id ?? null);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (folder) {
      setSelectedColId(folder.parent_id ?? null);
    }
  }, [folder]);

  if (!isOpen || !folder) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onMove(folder.id, selectedColId);
      onClose();
    } catch (err) {
      console.error("Failed to move album to collection:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div className="max-w-md w-full bg-surface-container-low/95 backdrop-blur-md border border-outline-variant/20 rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
          <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
            <FolderInput className="w-5 h-5 text-primary" />
            <span>Move to Collection</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-on-surface-variant">
          Assign album <span className="font-semibold text-on-surface">"{folder.name}"</span> to a parent collection:
        </p>

        {/* Options List */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {/* Option: None / Standalone */}
          <button
            type="button"
            onClick={() => setSelectedColId(null)}
            className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              selectedColId === null
                ? "bg-primary/10 border-primary/40 text-primary shadow-sm"
                : "bg-surface-container-lowest/80 border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Folder className="w-4 h-4" />
              <span>Standalone (No Collection)</span>
            </div>
            {selectedColId === null && <Check className="w-4 h-4 text-primary" />}
          </button>

          {/* List of Available Collections */}
          {collections.map((col) => {
            const isSelected = selectedColId === col.id;
            return (
              <button
                key={col.id}
                type="button"
                onClick={() => setSelectedColId(col.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary/10 border-primary/40 text-primary shadow-sm"
                    : "bg-surface-container-lowest/80 border-outline-variant/15 text-on-surface hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate pr-2">
                  <Layers className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{col.name}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/15">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold hover:bg-primary/90 active:scale-95 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
};
