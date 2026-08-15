/**
 * =============================================================================
 * Module: frontend/src/components/VideoPlayer.tsx
 * Purpose: Seekable HTML5 video streaming player using HTTP 206 Partial Content stream.
 * Used by: frontend/src/components/MediaLightbox.tsx
 * Dependencies: React, frontend/src/types.ts
 * Public Members: VideoPlayer
 * Side Effects: Requests video stream byte chunks over HTTP.
 * =============================================================================
 */

import React, { useRef, useState } from "react";
import { MediaItem } from "../types";

interface VideoPlayerProps {
  item: MediaItem;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ item }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black/90">
      <video
        ref={videoRef}
        src={item.stream_url}
        controls
        autoPlay
        playsInline
        onWaiting={() => setLoading(true)}
        onPlaying={() => setLoading(false)}
        onCanPlay={() => setLoading(false)}
        className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
      >
        Your browser does not support HTML5 video streaming.
      </video>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
};
