/**
 * =============================================================================
 * Module: frontend/src/components/UploadManager.tsx
 * Purpose: Google Drive-style floating upload manager widget with individual per-file
 *          progress bars, byte transfer counters, processing/syncing indicators,
 *          duplicate conflict badges, collapsible panel, and completion badges.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: UploadManager
 * Side Effects: Renders floating portal overlay, manages panel collapse state.
 * =============================================================================
 */

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileVideo,
  FileImage,
  UploadCloud,
  Copy,
} from "lucide-react";
import { UploadTask } from "../types";

interface UploadManagerProps {
  tasks: UploadTask[];
  onDismiss: () => void;
  onClearCompleted: () => void;
}

export const UploadManager: React.FC<UploadManagerProps> = ({
  tasks,
  onDismiss,
  onClearCompleted,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (tasks.length === 0) return null;

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const duplicateCount = tasks.filter((t) => t.status === "duplicate").length;
  const inProgressCount = tasks.filter(
    (t) => t.status === "uploading" || t.status === "processing" || t.status === "pending"
  ).length;

  const totalLoaded = tasks.reduce((sum, t) => sum + (t.loadedBytes || 0), 0);
  const totalSize = tasks.reduce((sum, t) => sum + (t.size || 0), 0);
  const overallPercent = totalSize > 0 ? Math.round((totalLoaded / totalSize) * 100) : 0;

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 bg-zinc-900/95 border border-zinc-800/80 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
      {/* Header Bar */}
      <div
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="flex items-center justify-between px-4 py-3 bg-zinc-950/60 border-b border-zinc-800/60 cursor-pointer select-none hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            {inProgressCount > 0 ? (
              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
            ) : (
              <UploadCloud className="w-4 h-4 text-sky-400" />
            )}
          </div>
          <div className="truncate">
            <h4 className="text-xs font-bold text-white truncate">
              {inProgressCount > 0
                ? `Uploading ${inProgressCount} item${inProgressCount > 1 ? "s" : ""} (${overallPercent}%)`
                : duplicateCount > 0
                ? `${completedCount} uploaded • ${duplicateCount} duplicate${duplicateCount > 1 ? "s" : ""}`
                : `${completedCount} upload${completedCount > 1 ? "s" : ""} complete`}
            </h4>
            <p className="text-[11px] text-zinc-400 truncate">
              {formatBytes(totalLoaded)} of {formatBytes(totalSize)}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
          {(completedCount > 0 || duplicateCount > 0) && inProgressCount === 0 && (
            <button
              onClick={onClearCompleted}
              className="text-[11px] font-semibold text-zinc-400 hover:text-sky-400 px-1.5 py-0.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {inProgressCount === 0 && (
            <button
              onClick={onDismiss}
              className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title="Close upload widget"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible File List Body */}
      {!isCollapsed && (
        <div className="max-h-64 overflow-y-auto divide-y divide-zinc-800/40 p-2 space-y-1">
          {tasks.map((task) => {
            const isVideo = task.type.startsWith("video/");
            return (
              <div
                key={task.id}
                className="p-2 rounded-xl hover:bg-zinc-800/30 transition-colors space-y-1.5"
              >
                {/* File Row Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 shrink-0">
                      {isVideo ? (
                        <FileVideo className="w-4 h-4 text-purple-400" />
                      ) : (
                        <FileImage className="w-4 h-4 text-sky-400" />
                      )}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-zinc-200 truncate">{task.name}</p>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        {task.status === "uploading" && (
                          <span>
                            {formatBytes(task.loadedBytes)} of {formatBytes(task.size)} • {task.progress}%
                          </span>
                        )}
                        {task.status === "processing" && (
                          <span className="text-sky-400 font-medium">
                            Syncing to Telegram Vault...
                          </span>
                        )}
                        {task.status === "pending" && <span>In queue...</span>}
                        {task.status === "completed" && (
                          <span className="text-emerald-400">{formatBytes(task.size)} • Saved in Vault</span>
                        )}
                        {task.status === "duplicate" && (
                          <span className="text-amber-400">
                            {task.duplicateInfo?.actionTaken === "renamed_existing"
                              ? "Duplicate • Renamed existing"
                              : task.duplicateInfo?.actionTaken === "alias_created"
                              ? "Duplicate • Saved copy"
                              : "Duplicate • Skipped upload"}
                          </span>
                        )}
                        {task.status === "error" && (
                          <span className="text-red-400">{task.errorMessage || "Upload failed"}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="shrink-0">
                    {(task.status === "uploading" || task.status === "processing") && (
                      <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                    )}
                    {task.status === "pending" && (
                      <div className="w-2 h-2 rounded-full bg-zinc-500" />
                    )}
                    {task.status === "completed" && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    {task.status === "duplicate" && (
                      <Copy className="w-4 h-4 text-amber-400" />
                    )}
                    {task.status === "error" && (
                      <AlertCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {(task.status === "uploading" ||
                  task.status === "processing" ||
                  task.status === "pending") && (
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${task.progress}%` }}
                      className={`h-full rounded-full transition-all duration-150 ${
                        task.status === "processing"
                          ? "bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-500 animate-pulse"
                          : "bg-gradient-to-r from-sky-400 to-indigo-500"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
