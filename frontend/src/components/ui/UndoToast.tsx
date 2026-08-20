/**
 * =============================================================================
 * Module: frontend/src/components/ui/UndoToast.tsx
 * Purpose: Floating 5-second countdown notification toast providing an 'Undo'
 *          action for deleted files before permanent MTProto deletion is committed.
 * Used by: frontend/src/App.tsx
 * Dependencies: lucide-react, framer-motion
 * Public Members: UndoToast
 * Side Effects: Triggers timer countdown and calls onUndo or onCommit callbacks.
 * =============================================================================
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Trash2, X } from "lucide-react";

interface UndoToastProps {
  isOpen: boolean;
  message: string;
  durationMs?: number;
  onUndo: () => void;
  onCommit: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({
  isOpen,
  message,
  durationMs = 5000,
  onUndo,
  onCommit,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!isOpen) {
      setProgress(100);
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remaining);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        onCommit();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isOpen, durationMs, onCommit]);

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
          <div className="relative overflow-hidden bg-surface-base border border-outline-variant/20 rounded-neo-xl neo-card shadow-2xl p-3.5 pr-4 flex items-center gap-3.5 min-w-[280px] max-w-md">
            {/* Trash icon indicator */}
            <div className="w-9 h-9 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center shrink-0 neo-pressed">
              <Trash2 className="w-4 h-4" />
            </div>

            {/* Message info */}
            <div className="flex-1 min-w-0 pr-1">
              <p className="text-xs font-semibold text-on-surface truncate">
                {message}
              </p>
              <p className="text-[10px] text-on-surface-variant">
                Deleting in 5 seconds...
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
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* 5-second countdown progress bar at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-container-high">
              <div
                style={{ width: `${progress}%` }}
                className="h-full bg-primary transition-all duration-75 ease-linear rounded-full shadow-[0_0_8px_rgba(129,140,248,0.5)]"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
