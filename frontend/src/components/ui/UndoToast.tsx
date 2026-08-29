/**
 * =============================================================================
 * Module: frontend/src/components/ui/UndoToast.tsx
 * Purpose: Floating 10-second real-time countdown notification toast providing an 'Undo'
 *          action for deleted files before permanent MTProto deletion is committed.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, framer-motion, lucide-react
 * Public Members: UndoToast
 * Side Effects: Runs high-resolution timer countdown and triggers onUndo or onCommit callbacks.
 * =============================================================================
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trash2, X } from "lucide-react";
import { LiquidProgressBar } from "./LiquidProgressBar";

interface UndoToastProps {
  actionId?: number | string;
  isOpen: boolean;
  message: string;
  durationMs?: number;
  onUndo: () => void;
  onCommit: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({
  actionId,
  isOpen,
  message,
  durationMs = 10000,
  onUndo,
  onCommit,
}) => {
  const [progress, setProgress] = useState(100);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(durationMs / 1000));

  useEffect(() => {
    if (!isOpen) {
      setProgress(100);
      setSecondsLeft(Math.ceil(durationMs / 1000));
      return;
    }

    const startTime = Date.now();
    // Fresh reset for every new delete action
    setSecondsLeft(Math.ceil(durationMs / 1000));
    setProgress(100);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remainingMs = Math.max(0, durationMs - elapsed);
      const remainingProgress = Math.max(0, (remainingMs / durationMs) * 100);
      const currentSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

      setProgress(remainingProgress);
      setSecondsLeft(currentSeconds);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        onCommit();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isOpen, actionId, message, durationMs, onCommit]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 right-6 z-50 select-none"
        >
          <div className="relative overflow-hidden bg-surface-base border border-outline-variant/30 rounded-neo-xl neo-card shadow-[0_20px_50px_rgba(0,0,0,0.7)] p-3.5 pr-4 flex items-center gap-3.5 min-w-[300px] max-w-md">
            {/* Trash icon indicator */}
            <div className="w-9 h-9 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center shrink-0 neo-pressed">
              <Trash2 className="w-4 h-4" />
            </div>

            {/* Message info & countdown */}
            <div className="flex-1 min-w-0 pr-1">
              <p className="text-xs font-semibold text-on-surface truncate">
                {message}
              </p>
              <p className="text-[10px] text-on-surface-variant font-mono mt-0.5 flex items-center gap-1">
                <span>Deleting in</span>
                <span className="font-bold text-red-400 bg-red-500/10 px-1 py-0.2 rounded">
                  {secondsLeft}s
                </span>
                <span>• Undo to cancel</span>
              </p>
            </div>

            {/* Undo Action Button */}
            <button
              onClick={onUndo}
              className="px-3 py-1.5 rounded-neo bg-primary/10 hover:bg-primary/20 text-primary hover:scale-[1.02] text-xs font-bold transition-all flex items-center gap-1.5 neo-button cursor-pointer shrink-0"
              title="Undo Deletion"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>

            {/* Dismiss / Commit Button */}
            <button
              onClick={onCommit}
              className="p-1 rounded-full text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shrink-0"
              title="Dismiss and Delete Now"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* 10-second countdown liquid progress bar at bottom */}
            <div className="absolute bottom-0 left-0 right-0 overflow-hidden rounded-b-neo-xl">
              <LiquidProgressBar
                progress={progress}
                height="h-1.5"
                color="error"
                showGlow={false}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
