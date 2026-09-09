/**
 * =============================================================================
 * Module: frontend/src/components/UploadManager.tsx
 * Purpose: Google Drive-style floating upload manager widget with individual per-file
 *          progress bars, byte transfer counters, processing/syncing indicators,
 *          target album badges, duplicate conflict badges, collapsible panel, and completion badges.
 *          Engineered with pro-grade obsidian surfaces and hairline borders.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: UploadManager
 * Side Effects: Renders floating portal overlay, manages panel collapse state.
 * =============================================================================
 */

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
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
import { LiquidProgressBar } from "./ui/LiquidProgressBar";

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
  const prevInProgressRef = useRef(0);

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const duplicateCount = tasks.filter((t) => t.status === "duplicate").length;
  const inProgressCount = tasks.filter(
    (t) => t.status === "uploading" || t.status === "processing" || t.status === "pending"
  ).length;

  // Trigger celebration confetti when all uploads finish
  useEffect(() => {
    if (
      prevInProgressRef.current > 0 &&
      inProgressCount === 0 &&
      completedCount > 0
    ) {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.85, x: 0.85 },
          colors: ["#0ea5e9", "#38bdf8", "#6366f1", "#a855f7"],
        });
      } catch (e) {
        console.error("Confetti error", e);
      }
    }
    prevInProgressRef.current = inProgressCount;
  }, [inProgressCount, completedCount]);

  if (tasks.length === 0) return null;

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
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 rounded-2xl bg-surface-container-low/95 backdrop-blur-xl border border-outline-variant/20 shadow-2xl overflow-hidden"
    >
      {/* Header Bar */}
      <div
        onClick={() => setIsCollapsed((prev) => !prev)}
        className="flex items-center justify-between px-4 py-3 bg-surface-container-lowest/80 border-b border-outline-variant/15 cursor-pointer select-none hover:bg-surface-container transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-surface-container text-primary flex items-center justify-center shrink-0">
            {inProgressCount > 0 ? (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <UploadCloud className="w-4 h-4 text-primary" />
            )}
          </div>
          <div className="truncate">
            <h4 className="text-xs font-bold text-on-surface truncate">
              {inProgressCount > 0
                ? `Uploading ${inProgressCount} item${inProgressCount > 1 ? "s" : ""} (${overallPercent}%)`
                : duplicateCount > 0
                ? `${completedCount} uploaded • ${duplicateCount} duplicate${duplicateCount > 1 ? "s" : ""}`
                : `${completedCount} upload${completedCount > 1 ? "s" : ""} complete`}
            </h4>
            <p className="text-[11px] text-on-surface-variant font-mono truncate">
              {formatBytes(totalLoaded)} of {formatBytes(totalSize)}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
          {(completedCount > 0 || duplicateCount > 0) && inProgressCount === 0 && (
            <button
              onClick={onClearCompleted}
              className="text-[11px] font-semibold text-on-surface-variant hover:text-primary px-1.5 py-0.5 rounded-md hover:bg-surface-container transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="p-1 text-on-surface-variant hover:text-on-surface rounded-md hover:bg-surface-container transition-colors cursor-pointer"
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {inProgressCount === 0 && (
            <button
              onClick={onDismiss}
              className="p-1 text-on-surface-variant hover:text-on-surface rounded-md hover:bg-surface-container transition-colors cursor-pointer"
              title="Close upload widget"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible File List Body */}
      {!isCollapsed && (
        <div className="max-h-64 overflow-y-auto divide-y divide-outline-variant/15 p-2 space-y-1">
          {tasks.map((task) => {
            const isVideo = task.type.startsWith("video/");
            return (
              <div
                key={task.id}
                className="p-2 rounded-lg hover:bg-surface-container transition-colors space-y-1.5"
              >
                {/* File Row Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 rounded-md bg-surface-container-high text-on-surface-variant shrink-0">
                      {isVideo ? (
                        <FileVideo className="w-4 h-4 text-primary" />
                      ) : (
                        <FileImage className="w-4 h-4 text-on-surface-variant" />
                      )}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5 truncate">
                        <p className="text-xs font-semibold text-on-surface truncate">{task.name}</p>
                        {task.folderName && (
                          <span className="shrink-0 text-[9px] px-1.5 py-0.2 rounded bg-surface-container-highest text-primary font-medium">
                            {task.folderName}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-on-surface-variant font-mono">
                        {task.status === "uploading" && (
                          <span>
                            {formatBytes(task.loadedBytes)} of {formatBytes(task.size)} • {task.progress}%
                            {task.speedMbps && task.speedMbps > 0 ? ` • ${task.speedMbps} MB/s` : ""}
                          </span>
                        )}
                        {task.status === "processing" && (
                          <span className="text-primary font-medium">
                            Syncing to Telegram Vault...
                          </span>
                        )}
                        {task.status === "pending" && <span>In queue...</span>}
                        {task.status === "completed" && (
                          <span className="text-emerald-400 font-medium">{formatBytes(task.size)} • Saved in Vault</span>
                        )}
                        {task.status === "duplicate" && (
                          <span className="text-glow-indigo">
                            {task.duplicateInfo?.actionTaken === "renamed_existing"
                              ? "Duplicate • Renamed existing"
                              : task.duplicateInfo?.actionTaken === "alias_created"
                              ? "Duplicate • Saved copy"
                              : "Duplicate • Skipped upload"}
                          </span>
                        )}
                        {task.status === "error" && (
                          <span className="text-error">{task.errorMessage || "Upload failed"}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Status Indicator */}
                  <div className="shrink-0">
                    {(task.status === "uploading" || task.status === "processing") && (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    )}
                    {task.status === "pending" && (
                      <div className="w-2 h-2 rounded-full bg-surface-variant" />
                    )}
                    {task.status === "completed" && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    )}
                    {task.status === "duplicate" && (
                      <Copy className="w-4 h-4 text-glow-indigo" />
                    )}
                    {task.status === "error" && (
                      <AlertCircle className="w-4 h-4 text-error" />
                    )}
                  </div>
                </div>

                {/* Liquid Progress Bar */}
                {(task.status === "uploading" ||
                  task.status === "processing" ||
                  task.status === "pending") && (
                  <LiquidProgressBar
                    progress={task.progress}
                    height="h-2"
                    color="indigo"
                    isPulsing={task.status === "processing"}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
};
