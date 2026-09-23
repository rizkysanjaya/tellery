/**
 * =============================================================================
 * Module: frontend/src/components/OversizedFilesModal.tsx
 * Purpose: Informative modal dialog displayed when bulk or single uploads contain
 *          files exceeding Telegram's 2.0 GB (2048 MB) maximum upload ceiling.
 *          Provides itemized size breakdown and 1-click clipboard list export.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: OversizedFilesModal, OversizedFileItem
 * =============================================================================
 */

import React, { useState, useEffect, useRef } from "react";
import { AlertTriangle, Copy, Check, X, FileVideo, File, Info } from "lucide-react";

export interface OversizedFileItem {
  name: string;
  size: number;
}

interface OversizedFilesModalProps {
  files: OversizedFileItem[];
  onClose: () => void;
}

export const OversizedFilesModal: React.FC<OversizedFilesModalProps> = ({
  files,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Clean up copy feedback timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const formatFileSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(2)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const isVideoFile = (name: string) => {
    const ext = name.toLowerCase().split(".").pop() || "";
    return ["mp4", "mov", "mkv", "webm", "avi", "m4v", "wmv", "flv"].includes(ext);
  };

  const handleCopy = async () => {
    const text = files.map((f) => f.name).join("\n");
    let succeeded = false;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        succeeded = true;
      } catch {
        succeeded = false;
      }
    }

    // Fallback for non-secure / HTTP contexts or denied permissions
    if (!succeeded) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        succeeded = document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch (err) {
        console.error("Fallback clipboard copy failed:", err);
      }
    }

    if (succeeded) {
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="oversized-modal-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-surface-container-low/95 backdrop-blur-md border border-outline-variant/20 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant/15 flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-500 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="oversized-modal-title" className="text-base font-bold text-on-surface">
              {files.length === 1 ? "File Exceeds Size Limit" : `${files.length} Files Exceed Size Limit`}
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Standard Telegram channels limit individual files to <span className="font-semibold text-on-surface">2.0 GB (2048 MB)</span>. These files were skipped:
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-on-surface-variant/60 hover:text-on-surface hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable File List */}
        <div className="p-6 space-y-3">
          <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {files.map((file, idx) => {
              const isVideo = isVideoFile(file.name);
              return (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-container/60 border border-outline-variant/15 hover:border-outline-variant/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-2 rounded-lg bg-white/[0.04] text-on-surface-variant shrink-0">
                      {isVideo ? <FileVideo className="w-4 h-4 text-indigo-400" /> : <File className="w-4 h-4" />}
                    </div>
                    <span className="text-xs font-medium text-on-surface truncate" title={file.name}>
                      {file.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-mono font-semibold text-error px-2 py-0.5 rounded bg-error/10 border border-error/20">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cloud Info Notice */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/15 text-[11px] text-on-surface-variant leading-relaxed">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span>
                To store files larger than 2.0 GB, compress them using tools like HandBrake, split them into multi-part archives, or link a Telegram Premium account for up to 4.0 GB uploads.
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-surface-container-low border-t border-outline-variant/15 flex items-center justify-between gap-3">
          <button
            onClick={handleCopy}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-on-surface hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-outline-variant/20 transition-all cursor-pointer flex items-center gap-1.5"
            title="Copy list of oversized filenames to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy File Names</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-on-primary bg-primary hover:bg-primary/90 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
