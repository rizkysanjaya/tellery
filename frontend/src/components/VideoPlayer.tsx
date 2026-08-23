/**
 * =============================================================================
 * Module: frontend/src/components/VideoPlayer.tsx
 * Purpose: Top-tier custom dark studio video player with custom scrubber, hover preview,
 *          buffered range tracking, playback speed controls, picture-in-picture,
 *          keyboard shortcuts (YouTube/Netflix style), and auto-hiding controls.
 * Used by: frontend/src/components/MediaLightbox.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: VideoPlayer
 * Side Effects: Controls HTML5 video element playback, manages DOM fullscreen, reads/writes volume in localStorage.
 * =============================================================================
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture,
  Settings,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { MediaItem } from "../types";

interface VideoPlayerProps {
  item: MediaItem;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ item }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrubBarRef = useRef<HTMLDivElement>(null);
  const playedBarRef = useRef<HTMLDivElement>(null);
  const bufferedBarRef = useRef<HTMLDivElement>(null);
  const currentTimeDisplayRef = useRef<HTMLSpanElement>(null);
  const durationDisplayRef = useRef<HTMLSpanElement>(null);
  const hideControlsTimerRef = useRef<number | null>(null);

  // Playback States (macro states only - 0 re-renders during playback)
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [duration, setDuration] = useState(item.duration_seconds || 0);

  // Audio / Volume States
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem("telegallery_volume");
    return saved !== null ? parseFloat(saved) : 1;
  });
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem("telegallery_muted") === "true";
  });

  // UI / Controls States
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const isScrubbingRef = useRef(false);

  // Ripple Animation State
  const [centerRipple, setCenterRipple] = useState<"play" | "pause" | null>(null);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Reset states on item change
  useEffect(() => {
    setIsLoading(true);
    setIsPlaying(false);
    setHasError(false);
    setDuration(item.duration_seconds || 0);
    if (playedBarRef.current) playedBarRef.current.style.width = "0%";
    if (bufferedBarRef.current) bufferedBarRef.current.style.width = "0%";
    if (currentTimeDisplayRef.current) currentTimeDisplayRef.current.textContent = "00:00";
    if (durationDisplayRef.current) durationDisplayRef.current.textContent = formatTime(item.duration_seconds || 0);
  }, [item.id, item.stream_url, item.duration_seconds]);

  // Sync volume with video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      videoRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Controls auto-hide logic
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
    }
    if (isPlaying && !showSettingsMenu && !isScrubbingRef.current) {
      hideControlsTimerRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  }, [isPlaying, showSettingsMenu]);

  const handleMouseMove = () => {
    resetHideTimer();
  };

  // Toggle Play / Pause with ripple animation
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setCenterRipple("play");
          setTimeout(() => setCenterRipple(null), 500);
        })
        .catch((err) => console.error("Play error:", err));
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setCenterRipple("pause");
      setTimeout(() => setCenterRipple(null), 500);
    }
    resetHideTimer();
  }, [resetHideTimer]);

  const handleSkip = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(
      0,
      Math.min(videoRef.current.duration || duration, videoRef.current.currentTime + seconds)
    );
    resetHideTimer();
  }, [duration, resetHideTimer]);

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    localStorage.setItem("telegallery_volume", newVol.toString());
    localStorage.setItem("telegallery_muted", (newVol === 0).toString());
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      const targetVol = volume === 0 ? 0.5 : volume;
      setIsMuted(false);
      setVolume(targetVol);
      localStorage.setItem("telegallery_muted", "false");
    } else {
      setIsMuted(true);
      localStorage.setItem("telegallery_muted", "true");
    }
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSettingsMenu(false);
    resetHideTimer();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error("PiP error:", err);
    }
  };

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Time & Buffer Update Listeners (Direct DOM Mutation, 0 React Re-renders during 60fps playback)
  const handleTimeUpdate = () => {
    if (!videoRef.current || isScrubbingRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration || duration || 0;

    if (playedBarRef.current) {
      const pct = dur > 0 ? (cur / dur) * 100 : 0;
      playedBarRef.current.style.width = `${pct}%`;
    }
    if (currentTimeDisplayRef.current) {
      currentTimeDisplayRef.current.textContent = formatTime(cur);
    }
    if (bufferedBarRef.current && videoRef.current.buffered.length > 0 && dur > 0) {
      const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      bufferedBarRef.current.style.width = `${Math.min(100, (bufferedEnd / dur) * 100)}%`;
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      setDuration(dur);
      if (durationDisplayRef.current) {
        durationDisplayRef.current.textContent = formatTime(dur);
      }
      setIsLoading(false);
    }
  };

  // Scrub bar interactions
  const calculateScrubTime = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubBarRef.current || !videoRef.current) return 0;
    const rect = scrubBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return ratio * (videoRef.current.duration || duration || 1);
  };

  const handleScrubMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubBarRef.current) return;
    const rect = scrubBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(ratio * 100);
    setHoverTime(ratio * (duration || 1));
  };

  const handleScrubMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const targetTime = calculateScrubTime(e);
    isScrubbingRef.current = true;
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
      const dur = videoRef.current.duration || duration || 1;
      if (playedBarRef.current) {
        playedBarRef.current.style.width = `${(targetTime / dur) * 100}%`;
      }
      if (currentTimeDisplayRef.current) {
        currentTimeDisplayRef.current.textContent = formatTime(targetTime);
      }
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!scrubBarRef.current || !videoRef.current) return;
      const rect = scrubBarRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      const dur = videoRef.current.duration || duration || 1;
      const newTime = ratio * dur;
      videoRef.current.currentTime = newTime;
      if (playedBarRef.current) {
        playedBarRef.current.style.width = `${ratio * 100}%`;
      }
      if (currentTimeDisplayRef.current) {
        currentTimeDisplayRef.current.textContent = formatTime(newTime);
      }
    };

    const onMouseUp = () => {
      isScrubbingRef.current = false;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      resetHideTimer();
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "arrowleft":
        case "j":
          e.preventDefault();
          handleSkip(-5);
          break;
        case "arrowright":
        case "l":
          e.preventDefault();
          handleSkip(5);
          break;
        case "arrowup":
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case "arrowdown":
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "p":
          e.preventDefault();
          togglePiP();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, handleSkip, volume, isMuted]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="relative w-full h-full max-h-[85vh] flex items-center justify-center bg-black rounded-2xl overflow-hidden shadow-2xl select-none group"
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={item.stream_url}
        poster={item.thumbnail_url || undefined}
        playsInline
        preload="auto"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => {
          setIsPlaying(true);
          setIsLoading(false);
        }}
        onPause={() => {
          setIsPlaying(false);
          setIsLoading(false);
        }}
        onError={(e) => {
          console.error("Video error:", e);
          setIsLoading(false);
          setHasError(true);
        }}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Center Action Ripple Animation */}
      {centerRipple && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 animate-in fade-in zoom-in-75 duration-300">
          <div className="w-20 h-20 rounded-full bg-zinc-950/80 backdrop-blur-md border border-white/15 flex items-center justify-center shadow-2xl">
            {centerRipple === "play" ? (
              <Play className="w-9 h-9 fill-white text-white ml-1" />
            ) : (
              <Pause className="w-9 h-9 fill-white text-white" />
            )}
          </div>
        </div>
      )}

      {/* Center Loading Spinner */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none z-10 animate-in fade-in duration-150">
          <Loader2 className="w-12 h-12 text-sky-400 animate-spin" />
        </div>
      )}

      {/* Playback Error Fallback */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 text-center p-6 z-30 animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-3">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h4 className="text-base font-bold text-white">Playback Error</h4>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            Unable to stream this video directly in your browser.
          </p>
          <a
            href={item.stream_url}
            download={item.file_name}
            className="mt-4 px-4 py-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white text-xs font-semibold rounded-xl shadow-lg shadow-sky-500/20 cursor-pointer"
          >
            Download Video
          </a>
        </div>
      )}

      {/* Glassmorphic Control Overlay Bar */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent pt-12 pb-3 px-4 sm:px-6 transition-opacity duration-300 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Scrubber Progress Bar */}
        <div
          ref={scrubBarRef}
          onMouseMove={handleScrubMouseMove}
          onMouseLeave={() => setHoverTime(null)}
          onMouseDown={handleScrubMouseDown}
          className="relative h-2 hover:h-3 w-full bg-white/20 hover:bg-white/30 rounded-full cursor-pointer transition-all duration-150 mb-3 group/scrubber"
        >
          {/* Hover Time Tooltip */}
          {hoverTime !== null && (
            <div
              style={{ left: `${hoverPosition}%` }}
              className="absolute bottom-4 -translate-x-1/2 z-30 px-2 py-1 bg-zinc-900 border border-zinc-700 text-[11px] font-mono font-bold text-white rounded-md shadow-xl pointer-events-none"
            >
              {formatTime(hoverTime)}
            </div>
          )}

          {/* Buffered Range Bar */}
          <div
            ref={bufferedBarRef}
            style={{ width: "0%" }}
            className="absolute top-0 bottom-0 left-0 bg-white/30 rounded-full transition-all duration-200"
          />

          {/* Played Progress Bar */}
          <div
            ref={playedBarRef}
            style={{ width: "0%" }}
            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-sky-400 to-sky-500 rounded-full flex items-center justify-end"
          >
            {/* Scrubber Thumb Knob */}
            <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md shadow-sky-500/50 scale-0 group-hover/scrubber:scale-100 transition-transform -mr-1.5" />
          </div>
        </div>

        {/* Buttons Controls Bar */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 text-white">
          {/* Left Controls (Play, Skip, Volume, Timers) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors cursor-pointer"
              title={isPlaying ? "Pause (Space/K)" : "Play (Space/K)"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-white text-white" />
              ) : (
                <Play className="w-5 h-5 fill-white text-white ml-0.5" />
              )}
            </button>

            {/* Skip Back 5s */}
            <button
              onClick={() => handleSkip(-5)}
              className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Skip backward 5s (Left Arrow/J)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Skip Forward 5s */}
            <button
              onClick={() => handleSkip(5)}
              className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Skip forward 5s (Right Arrow/L)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume Control Group */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                onClick={toggleMute}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                title={isMuted ? "Unmute (M)" : "Mute (M)"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              {/* Volume Slider Slider (Expands on Hover) */}
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-0 group-hover/vol:w-16 sm:group-hover/vol:w-20 transition-all duration-200 h-1.5 bg-white/20 accent-sky-400 rounded-lg cursor-pointer"
              />
            </div>

            {/* Time Stamp (Current / Total) */}
            <div className="text-xs font-mono text-white/80 tracking-tight ml-1">
              <span ref={currentTimeDisplayRef} className="text-white font-semibold">00:00</span>
              <span className="text-white/40 mx-1">/</span>
              <span ref={durationDisplayRef}>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls (Speed Settings, PiP, Fullscreen) */}
          <div className="flex items-center gap-1 sm:gap-2 relative">
            {/* Speed Settings Button & Menu */}
            <div className="relative">
              <button
                onClick={() => setShowSettingsMenu((p) => !p)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  showSettingsMenu
                    ? "bg-sky-500 text-white"
                    : "hover:bg-white/10 text-white/80 hover:text-white"
                }`}
                title="Playback Speed"
              >
                <Settings className="w-4 h-4" />
                <span className="text-[11px]">{playbackRate}x</span>
              </button>

              {/* Speed Popover Menu */}
              {showSettingsMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-36 bg-zinc-900 border border-zinc-700/80 rounded-2xl p-1.5 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="text-[10px] font-bold text-white/60 px-2 py-1 border-b border-zinc-800 mb-1">
                    Playback Speed
                  </div>
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handleRateChange(rate)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${
                        playbackRate === rate
                          ? "bg-sky-500/20 text-sky-300 font-bold"
                          : "text-white/80 hover:bg-zinc-800 hover:text-white"
                      }`}
                    >
                      <span>{rate === 1 ? "1.0x (Normal)" : `${rate}x`}</span>
                      {playbackRate === rate && <Check className="w-3.5 h-3.5 text-sky-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Picture in Picture */}
            <button
              onClick={togglePiP}
              className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Picture in Picture (P)"
            >
              <PictureInPicture className="w-4 h-4" />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
