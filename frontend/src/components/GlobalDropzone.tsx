/**
 * =============================================================================
 * Module: frontend/src/components/GlobalDropzone.tsx
 * Purpose: Silk Cloud full-window neomorphic drag-and-drop overlay. Provides sleek,
 *          zero-flicker visual feedback with context awareness (Vault Timeline vs
 *          target Album) and hints for recursive folder-to-album conversion.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, framer-motion, lucide-react
 * Public Members: GlobalDropzone
 * Side Effects: None (Presentational UI overlay).
 * =============================================================================
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FolderPlus, Sparkles, ShieldCheck } from "lucide-react";

interface GlobalDropzoneProps {
  isDragging: boolean;
  activeFolderName?: string;
}

export const GlobalDropzone: React.FC<GlobalDropzoneProps> = ({
  isDragging,
  activeFolderName,
}) => {
  return (
    <AnimatePresence>
      {isDragging && (
        <motion.div
          key="global-dropzone"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/85 backdrop-blur-sm pointer-events-none select-none"
        >
          <motion.div
            initial={{ scale: 0.92, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 15 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="neo-card bg-surface-base border-2 border-dashed border-primary/50 rounded-neo-xl p-8 sm:p-10 max-w-lg w-full flex flex-col items-center text-center shadow-2xl relative overflow-hidden"
          >
            {/* Ambient glow decoration */}
            <div className="absolute -top-16 -left-16 w-36 h-36 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-glow-indigo/10 rounded-full blur-2xl pointer-events-none" />

            {/* Central Animated Icon */}
            <div className="w-20 h-20 rounded-full neo-pressed bg-surface-container flex items-center justify-center mb-5 text-primary relative">
              <motion.div
                animate={{ y: [-2, 2, -2] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              >
                {activeFolderName ? (
                  <FolderPlus className="w-10 h-10 text-primary drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]" />
                ) : (
                  <UploadCloud className="w-10 h-10 text-primary drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]" />
                )}
              </motion.div>
            </div>

            {/* Context-aware Headline */}
            <h2 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
              {activeFolderName ? (
                <>
                  Drop to upload into{" "}
                  <span className="text-primary font-semibold block sm:inline mt-1 sm:mt-0">
                    "{activeFolderName}"
                  </span>
                </>
              ) : (
                "Drop Photos, Videos & Folders"
              )}
            </h2>

            {/* Context-aware Subtitle */}
            <p className="text-sm text-on-surface-variant mt-2 max-w-sm leading-relaxed">
              {activeFolderName
                ? "Items will be safely archived into your Telegram Vault and linked to this album."
                : "Files will be archived into your Telegram Vault. Dropped folders will automatically be converted into new Albums!"}
            </p>

            {/* Capability Feature Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-surface-container text-on-surface-variant neo-raised">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                Original Byte-for-Byte Quality
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-surface-container text-on-surface-variant neo-raised">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Deep Recursive Folder Crawl
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
