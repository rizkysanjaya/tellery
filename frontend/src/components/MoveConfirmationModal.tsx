/**
 * =============================================================================
 * Module: frontend/src/components/MoveConfirmationModal.tsx
 * Purpose: Confirmation modal displayed when moving media items that are already
 *          organized in other folders to a new target folder (1-to-1 hierarchy warning).
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react
 * Public Members: MoveConfirmationModal, MoveConflictItem
 * Side Effects: Prompts user before executing folder relocation.
 * =============================================================================
 */

import React from "react";
import { FolderInput, ArrowRight, X, AlertCircle } from "lucide-react";

export interface MoveConflictItem {
  id: number;
  fileName: string;
  currentFolderName: string;
}

interface MoveConfirmationModalProps {
  targetFolderName: string;
  targetFolderId: number;
  conflictedItems: MoveConflictItem[];
  totalSelectedCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const MoveConfirmationModal: React.FC<MoveConfirmationModalProps> = ({
  targetFolderName,
  conflictedItems,
  totalSelectedCount,
  onConfirm,
  onCancel,
}) => {
  const isSingle = conflictedItems.length === 1;

  // Distinct list of current folders affected
  const sourceFolderNames = Array.from(
    new Set(conflictedItems.map((item) => item.currentFolderName))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-800/80 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <FolderInput className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Move to "{targetFolderName}"?</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Media item relocation confirmation
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-2.5 p-3.5 bg-amber-500/5 border border-amber-500/15 rounded-2xl text-xs text-amber-300/90 leading-relaxed">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              {isSingle ? (
                <p>
                  <span className="font-semibold text-white">"{conflictedItems[0].fileName}"</span> is currently organized in{" "}
                  <span className="font-semibold text-white">"{conflictedItems[0].currentFolderName}"</span>.
                  Moving it will remove it from{" "}
                  <span className="font-semibold text-white">"{conflictedItems[0].currentFolderName}"</span> and place it in{" "}
                  <span className="font-semibold text-white">"{targetFolderName}"</span>.
                </p>
              ) : (
                <p>
                  <span className="font-semibold text-white">{conflictedItems.length}</span> of your{" "}
                  <span className="font-semibold text-white">{totalSelectedCount}</span> selected items are already organized in other folders (
                  <span className="font-semibold text-white">{sourceFolderNames.join(", ")}</span>).
                  Moving will relocate them to <span className="font-semibold text-white">"{targetFolderName}"</span>.
                </p>
              )}
            </div>
          </div>

          {/* Relocation Preview Items List */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              Items to relocate:
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
              {conflictedItems.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 bg-zinc-950/60 border border-zinc-800/60 rounded-xl text-xs"
                >
                  <span className="text-zinc-200 font-medium truncate max-w-[150px]">
                    {item.fileName}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] shrink-0">
                    <span className="text-zinc-400 font-semibold">{item.currentFolderName}</span>
                    <ArrowRight className="w-3 h-3 text-sky-400" />
                    <span className="text-sky-400 font-bold">{targetFolderName}</span>
                  </div>
                </div>
              ))}
              {conflictedItems.length > 5 && (
                <p className="text-[11px] text-zinc-500 text-center pt-1">
                  ...and {conflictedItems.length - 5} more item{conflictedItems.length - 5 > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-zinc-950/60 border-t border-zinc-800/80 flex items-center justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 shadow-lg shadow-sky-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <FolderInput className="w-3.5 h-3.5" />
            Move to "{targetFolderName}"
          </button>
        </div>
      </div>
    </div>
  );
};
