/**
 * =============================================================================
 * Module: frontend/src/components/MediaLightbox.tsx
 * Purpose: Fullscreen modal lightbox with EXIF drawer, keyboard navigation, and zoom.
 * Used by: frontend/src/App.tsx
 * Dependencies: lucide-react, frontend/src/types.ts, frontend/src/components/VideoPlayer.tsx
 * Public Members: MediaLightbox
 * Side Effects: Listens for window keydown events (Escape, ArrowLeft, ArrowRight).
 * =============================================================================
 */

import React, { useEffect, useState } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Download,
  Calendar,
  Camera,
  Maximize2,
  HardDrive,
  FileCode,
} from "lucide-react";
import { MediaItem } from "../types";
import { VideoPlayer } from "./VideoPlayer";

interface MediaLightboxProps {
  item: MediaItem;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export const MediaLightbox: React.FC<MediaLightboxProps> = ({
  item,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const isVideo = item.mime_type.startsWith("video/");

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
      if (e.key === "i" || e.key === "I") setShowInfo((prev) => !prev);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  const formatBytes = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "Unknown";
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col select-none animate-in fade-in duration-200">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-3.5 bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="truncate max-w-[200px] sm:max-w-md">
            <h3 className="text-sm font-semibold text-white truncate">{item.file_name}</h3>
            <p className="text-xs text-zinc-400">{formatDate(item.date_taken)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={item.stream_url}
            download={item.file_name}
            className="p-2 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
            title="Download Original"
          >
            <Download className="w-5 h-5" />
          </a>
          <button
            onClick={() => setShowInfo((prev) => !prev)}
            className={`p-2 rounded-full transition-colors ${
              showInfo ? "bg-sky-500 text-white" : "hover:bg-white/10 text-zinc-300 hover:text-white"
            }`}
            title="Toggle Metadata Info (I)"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {/* Navigation Arrows */}
        {hasPrev && (
          <button
            onClick={onPrev}
            className="absolute left-4 z-20 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white backdrop-blur-md border border-white/10 transition-all hover:scale-105"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {hasNext && (
          <button
            onClick={onNext}
            className="absolute right-4 z-20 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white backdrop-blur-md border border-white/10 transition-all hover:scale-105"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Media Renderer */}
        <div className="w-full h-full flex items-center justify-center p-4">
          {isVideo ? (
            <VideoPlayer item={item} />
          ) : (
            <img
              src={item.stream_url}
              alt={item.file_name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl transition-all"
            />
          )}
        </div>

        {/* EXIF & Technical Metadata Drawer */}
        {showInfo && (
          <aside className="absolute right-0 top-0 bottom-0 w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800 p-6 overflow-y-auto z-30 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-400" />
                Technical Metadata
              </h4>
              <button
                onClick={() => setShowInfo(false)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-6 space-y-5 text-xs">
              {/* Date Taken */}
              <div>
                <span className="text-zinc-500 font-medium flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  Date Captured
                </span>
                <p className="text-zinc-200 font-semibold">{formatDate(item.date_taken)}</p>
              </div>

              {/* Camera Model */}
              {(item.camera_make || item.camera_model) && (
                <div>
                  <span className="text-zinc-500 font-medium flex items-center gap-1.5 mb-1">
                    <Camera className="w-3.5 h-3.5 text-sky-400" />
                    Camera Device
                  </span>
                  <p className="text-zinc-200 font-semibold">
                    {[item.camera_make, item.camera_model].filter(Boolean).join(" ")}
                  </p>
                </div>
              )}

              {/* Dimensions */}
              {item.width && item.height && (
                <div>
                  <span className="text-zinc-500 font-medium flex items-center gap-1.5 mb-1">
                    <Maximize2 className="w-3.5 h-3.5 text-sky-400" />
                    Resolution
                  </span>
                  <p className="text-zinc-200 font-semibold">
                    {item.width} × {item.height} px
                  </p>
                </div>
              )}

              {/* File Size */}
              <div>
                <span className="text-zinc-500 font-medium flex items-center gap-1.5 mb-1">
                  <HardDrive className="w-3.5 h-3.5 text-sky-400" />
                  File Size
                </span>
                <p className="text-zinc-200 font-semibold">{formatBytes(item.file_size)}</p>
              </div>

              {/* MIME Type */}
              <div>
                <span className="text-zinc-500 font-medium flex items-center gap-1.5 mb-1">
                  <FileCode className="w-3.5 h-3.5 text-sky-400" />
                  Format / MIME
                </span>
                <p className="text-zinc-200 font-semibold font-mono">{item.mime_type}</p>
              </div>

              {/* Storage Info */}
              <div className="pt-4 border-t border-zinc-800">
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-bold">
                  Storage Backend
                </span>
                <div className="mt-2 p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80">
                  <p className="text-sky-400 font-semibold">Telegram MTProto Vault</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Original uncompressed raw document
                  </p>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
