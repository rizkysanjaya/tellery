/**
 * =============================================================================
 * Module: frontend/src/components/MediaCard.tsx
 * Purpose: Interactive gallery grid tile displaying WebP thumbnail and badges.
 * Used by: frontend/src/components/TimelineGrid.tsx
 * Dependencies: lucide-react, frontend/src/types.ts
 * Public Members: MediaCard
 * Side Effects: Triggers lightbox click event.
 * =============================================================================
 */

import React, { useState } from "react";
import { Play, Image as ImageIcon, Camera } from "lucide-react";
import { MediaItem } from "../types";

interface MediaCardProps {
  item: MediaItem;
  onClick: () => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({ item, onClick }) => {
  const [loaded, setLoaded] = useState(false);
  const isVideo = item.mime_type.startsWith("video/");

  const formatDuration = (sec: number | null) => {
    if (!sec) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      onClick={onClick}
      className="group relative aspect-square bg-zinc-900 rounded-2xl overflow-hidden cursor-pointer border border-zinc-800/60 hover:border-sky-500/50 hover:shadow-xl hover:shadow-sky-500/10 transition-all duration-300 transform hover:-translate-y-1"
    >
      {/* Thumbnail Image */}
      {item.thumbnail_url ? (
        <img
          src={item.thumbnail_url}
          alt={item.file_name}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-105 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-900/50">
          <ImageIcon className="w-8 h-8 mb-1 opacity-50" />
          <span className="text-[10px] text-zinc-500 truncate max-w-[80%]">
            {item.file_name}
          </span>
        </div>
      )}

      {/* Video Indicator / Play Badge */}
      {isVideo && (
        <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1.5 text-[11px] font-medium text-white shadow-sm border border-white/10">
          <Play className="w-3 h-3 fill-white text-white" />
          {item.duration_seconds ? <span>{formatDuration(item.duration_seconds)}</span> : null}
        </div>
      )}

      {/* Overlay details on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 pointer-events-none">
        <p className="text-xs font-semibold text-white truncate drop-shadow-sm">
          {item.file_name}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-zinc-300 mt-0.5">
          {item.camera_model && (
            <span className="flex items-center gap-1">
              <Camera className="w-3 h-3 text-sky-400" />
              {item.camera_model}
            </span>
          )}
          {item.width && item.height && (
            <span>
              {item.width}×{item.height}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
