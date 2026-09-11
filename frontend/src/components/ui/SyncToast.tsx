/**
 * =============================================================================
 * Module: frontend/src/components/ui/SyncToast.tsx
 * Purpose: Floating bottom notification pill indicating background Telegram vault synchronization
 *          with animated spinner, glowing primary badge, indeterminate progress shimmer,
 *          and elapsed timer to keep user informed during large media indexings.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, framer-motion, lucide-react
 * Public Members: SyncToast
 * Side Effects: Runs internal elapsed seconds counter while active.
 * =============================================================================
 */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";

interface SyncToastProps {
  isSyncing: boolean;
  vaultTitle?: string | null;
}

export const SyncToast: React.FC<SyncToastProps> = ({ isSyncing, vaultTitle }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isSyncing) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isSyncing]);

  return (
    <AnimatePresence>
      {isSyncing && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="fixed bottom-8 left-0 right-0 md:left-64 pointer-events-none flex justify-center z-50 px-4"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto relative flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-surface-container-low/95 backdrop-blur-xl border border-primary/30 shadow-[0_12px_36px_rgba(0,0,0,0.55)] overflow-hidden">
            {/* Ambient Primary Glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent pointer-events-none" />

            {/* Glowing Icon Container */}
            <div className="relative w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 border border-primary/30 text-primary">
              <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
            </div>

            {/* Text Message */}
            <div className="flex flex-col min-w-0 pr-2">
              <span className="text-xs sm:text-sm font-semibold text-on-surface tracking-tight leading-tight">
                We're indexing your medias, sit back and relax
              </span>
              <span className="text-[11px] text-on-surface-variant flex items-center gap-1.5 mt-0.5">
                <span>{vaultTitle ? `Scanning ${vaultTitle}` : "Scanning Telegram channel"}</span>
                {elapsed > 0 && <span>• {elapsed}s</span>}
              </span>
            </div>

            {/* Indeterminate bottom progress shimmer bar */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary/15 overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{
                  repeat: Infinity,
                  duration: 1.6,
                  ease: "easeInOut",
                }}
                style={{ width: "45%" }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
