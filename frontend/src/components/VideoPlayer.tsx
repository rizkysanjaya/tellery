/**
 * =============================================================================
 * Module: frontend/src/components/VideoPlayer.tsx
 * Purpose: Seekable HTML5 video player with poster preview, autoplay policy fallback,
 *          custom play/pause overlays, and error resilience.
 * Used by: frontend/src/components/MediaLightbox.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: VideoPlayer
 * Side Effects: Streams video chunks over HTTP 206 Partial Content, controls DOM video element.
 * =============================================================================
 */

import React, { useEffect, useRef, useState } from "react";
import { Play, AlertCircle, Loader2 } from "lucide-react";
import { MediaItem } from "../types";

interface VideoPlayerProps {
  item: MediaItem;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ item }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setIsPlaying(false);
    setHasError(false);
    setAutoplayBlocked(false);

    const video = videoRef.current;
    if (!video) return;

    // Attempt autoplay, catch browser policy rejection gracefully
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch(() => {
          // Autoplay blocked by browser policy; show play button overlay
          setAutoplayBlocked(true);
          setIsLoading(false);
        });
    }
  }, [item.id, item.stream_url]);

  const handleManualPlay = () => {
    if (videoRef.current) {
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch((err) => {
          console.error("Manual play error:", err);
        });
    }
  };

  return (
    <div className="relative max-w-full max-h-[85vh] flex items-center justify-center bg-black/80 rounded-2xl overflow-hidden shadow-2xl">
      <video
        ref={videoRef}
        src={item.stream_url}
        poster={item.thumbnail_url || undefined}
        controls
        playsInline
        preload="metadata"
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onLoadedData={() => setIsLoading(false)}
        onLoadedMetadata={() => setIsLoading(false)}
        onPlay={() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
          setIsLoading(false);
        }}
        onPlaying={() => {
          setIsPlaying(true);
          setIsLoading(false);
        }}
        onPause={() => {
          setIsPlaying(false);
          setIsLoading(false);
        }}
        onError={(e) => {
          console.error("HTML5 Video playback error:", e);
          setIsLoading(false);
          setHasError(true);
        }}
        className="max-w-full max-h-[85vh] object-contain rounded-2xl"
      >
        Your browser does not support HTML5 video playback.
      </video>

      {/* Loading Spinner */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none z-10 animate-in fade-in duration-150">
          <Loader2 className="w-12 h-12 text-sky-400 animate-spin" />
        </div>
      )}

      {/* Autoplay Blocked Play Button Overlay */}
      {autoplayBlocked && !isPlaying && !isLoading && !hasError && (
        <div
          onClick={handleManualPlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer z-10 group"
        >
          <div className="w-16 h-16 rounded-full bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center shadow-2xl shadow-sky-500/50 group-hover:scale-110 transition-transform">
            <Play className="w-8 h-8 fill-white ml-1" />
          </div>
        </div>
      )}

      {/* Error Fallback */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 text-center p-6 z-10">
          <AlertCircle className="w-10 h-10 text-red-400 mb-2" />
          <h4 className="text-sm font-bold text-white">Playback Error</h4>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            Unable to stream this video codec directly in the browser.
          </p>
          <a
            href={item.stream_url}
            download={item.file_name}
            className="mt-3 px-4 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold rounded-xl"
          >
            Download Video
          </a>
        </div>
      )}
    </div>
  );
};
