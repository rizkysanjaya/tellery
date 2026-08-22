/**
 * =============================================================================
 * Module: frontend/src/components/DuplicateConflictModal.tsx
 * Purpose: Google Drive-style interactive modal for resolving duplicate file conflicts
 *          during uploads (Skip, Keep Both with Custom Name, Rename Existing).
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: DuplicateConflictModal
 * Side Effects: Dispatches user resolution choice, updates batch preferences.
 * =============================================================================
 */

import React, { useState } from "react";
import { SkipForward, Edit3, Files, Check, AlertTriangle } from "lucide-react";
import { DuplicateConflict, ConflictResolutionAction } from "../types";

interface DuplicateConflictModalProps {
  conflict: DuplicateConflict;
  onResolve: (
    action: ConflictResolutionAction,
    customName?: string,
    applyToAll?: boolean
  ) => void;
  onCancel: () => void;
}

export const DuplicateConflictModal: React.FC<DuplicateConflictModalProps> = ({
  conflict,
  onResolve,
  onCancel,
}) => {
  const [selectedAction, setSelectedAction] = useState<ConflictResolutionAction>("skip");
  const [applyToAll, setApplyToAll] = useState(false);

  // Generate suggested "(1)" clone filename
  const getSuggestedName = (orig: string) => {
    const lastDot = orig.lastIndexOf(".");
    if (lastDot === -1) return `${orig} (1)`;
    const base = orig.substring(0, lastDot);
    const ext = orig.substring(lastDot);
    return `${base} (1)${ext}`;
  };

  const [keepBothName, setKeepBothName] = useState(getSuggestedName(conflict.fileName));
  const [renameExistingName, setRenameExistingName] = useState(conflict.fileName);

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const handleConfirm = () => {
    let customName: string | undefined;
    if (selectedAction === "keep_both") {
      customName = keepBothName.trim() || getSuggestedName(conflict.fileName);
    } else if (selectedAction === "rename_existing") {
      customName = renameExistingName.trim() || conflict.fileName;
    }
    onResolve(selectedAction, customName, applyToAll);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-800/80 flex items-start gap-4">
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Duplicate File Detected</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              An identical file already exists in your private Telegram storage vault.
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Comparison Card */}
          <div className="p-3.5 bg-zinc-950/60 border border-zinc-800/60 rounded-2xl space-y-2 text-xs">
            <div className="flex items-center justify-between text-zinc-300">
              <span className="font-semibold text-zinc-400">Existing in Vault:</span>
              <span className="font-mono text-zinc-300 truncate max-w-[200px]">
                {conflict.existingFileName}
              </span>
            </div>
            <div className="flex items-center justify-between text-zinc-300">
              <span className="font-semibold text-zinc-400">File Size:</span>
              <span className="font-mono text-zinc-400">{formatBytes(conflict.fileSize)}</span>
            </div>
          </div>

          {/* Action Options */}
          <div className="space-y-2.5">
            <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
              Choose an Action:
            </p>

            {/* Option 1: Skip */}
            <label
              onClick={() => setSelectedAction("skip")}
              className={`flex items-start gap-3.5 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                selectedAction === "skip"
                  ? "bg-sky-500/10 border-sky-500/50 ring-1 ring-sky-500/30"
                  : "bg-zinc-800/30 border-zinc-800 hover:bg-zinc-800/60"
              }`}
            >
              <input
                type="radio"
                name="duplicateAction"
                checked={selectedAction === "skip"}
                onChange={() => setSelectedAction("skip")}
                className="mt-1 text-sky-500 focus:ring-0"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <SkipForward className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-white">Skip Duplicate</span>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20 ml-auto">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Do not re-upload; saves storage bandwidth and Telegram quotas.
                </p>
              </div>
            </label>

            {/* Option 2: Keep Both & Rename */}
            <label
              onClick={() => setSelectedAction("keep_both")}
              className={`flex items-start gap-3.5 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                selectedAction === "keep_both"
                  ? "bg-sky-500/10 border-sky-500/50 ring-1 ring-sky-500/30"
                  : "bg-zinc-800/30 border-zinc-800 hover:bg-zinc-800/60"
              }`}
            >
              <input
                type="radio"
                name="duplicateAction"
                checked={selectedAction === "keep_both"}
                onChange={() => setSelectedAction("keep_both")}
                className="mt-1 text-sky-500 focus:ring-0"
              />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Files className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white">Keep Both (Rename New)</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Creates a second catalog entry without wasting extra Telegram storage.
                </p>
                {selectedAction === "keep_both" && (
                  <div className="pt-1">
                    <input
                      type="text"
                      value={keepBothName}
                      onChange={(e) => setKeepBothName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="New filename"
                      className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                )}
              </div>
            </label>

            {/* Option 3: Rename Existing */}
            <label
              onClick={() => setSelectedAction("rename_existing")}
              className={`flex items-start gap-3.5 p-3.5 rounded-2xl border cursor-pointer transition-all ${
                selectedAction === "rename_existing"
                  ? "bg-sky-500/10 border-sky-500/50 ring-1 ring-sky-500/30"
                  : "bg-zinc-800/30 border-zinc-800 hover:bg-zinc-800/60"
              }`}
            >
              <input
                type="radio"
                name="duplicateAction"
                checked={selectedAction === "rename_existing"}
                onChange={() => setSelectedAction("rename_existing")}
                className="mt-1 text-sky-500 focus:ring-0"
              />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">Rename Existing in Vault</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Updates the name of the file already in your vault to this new name.
                </p>
                {selectedAction === "rename_existing" && (
                  <div className="pt-1">
                    <input
                      type="text"
                      value={renameExistingName}
                      onChange={(e) => setRenameExistingName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Updated filename"
                      className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Apply to all batch items checkbox */}
          <div className="pt-1 flex items-center gap-2 select-none">
            <input
              type="checkbox"
              id="applyAllDuplicates"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
              className="w-4 h-4 rounded text-sky-500 bg-zinc-800 border-zinc-700 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="applyAllDuplicates" className="text-xs text-zinc-300 cursor-pointer">
              Apply this choice to all remaining duplicates in this batch
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-zinc-950/60 border-t border-zinc-800/80 flex items-center justify-end gap-2.5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
          >
            Cancel Upload
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-sky-500 hover:bg-sky-400 shadow-lg shadow-sky-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Apply Choice
          </button>
        </div>
      </div>
    </div>
  );
};
