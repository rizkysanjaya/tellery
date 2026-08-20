/**
 * =============================================================================
 * Module: frontend/src/components/VideoPlayer.tsx
 * Purpose: Top-tier custom dark studio video player with custom scrubber, hover preview,
 *          buffered range tracking, playback speed controls, picture-in-picture,
 *          keyboard shortcuts (YouTube/Netflix style), and auto-hiding controls.
 *          Updated to match Silk Cloud dark neomorphic design system.
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

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative w-full h-full max-h-[88vh] flex items-center justify-center select-none group rounded-neo-xl overflow-hidden bg-black/40 ${
        isFullscreen ? "w-screen h-screen max-h-screen rounded-none bg-black" : ""
      }`}
    >
      {/* Main Video Element - Fills all available viewport space with object-contain */}
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
        className="w-full h-full max-h-[88vh] object-contain cursor-pointer"
      />

      {/* Center Action Ripple Animation */}
      {centerRipple && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 animate-in fade-in zoom-in-75 duration-300">
          <div className="w-20 h-20 rounded-full bg-surface-base/80 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.5)]">
            {centerRipple === "play" ? (
              <Play className="w-9 h-9 fill-primary text-primary ml-1" />
            ) : (
              <Pause className="w-9 h-9 fill-primary text-primary" />
            )}
          </div>
        </div>
      )}

      {/* Center Loading Spinner */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-xs pointer-events-none z-10 animate-in fade-in duration-150">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      )}

      {/* Playback Error Fallback */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-base text-center p-6 z-30 animate-in fade-in duration-200">
          <div className="w-14 h-14 rounded-neo-lg bg-red-500/10 text-red-400 flex items-center justify-center mb-3 neo-pressed">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h4 className="text-base font-bold text-on-surface">Playback Error</h4>
          <p className="text-xs text-on-surface-variant mt-1 max-w-xs">
            Unable to stream this video directly in your browser.
          </p>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleRetry}
              className="px-4 py-2 neo-button-primary rounded-neo-lg text-xs font-semibold shadow-[0_0_15px_rgba(129,140,248,0.3)] cursor-pointer"
            >
              Retry Playback
            </button>
            <a
              href={item.stream_url}
              download={item.file_name}
              className="px-4 py-2 neo-button rounded-neo-lg text-xs font-medium text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              Download Video
            </a>
          </div>
        </div>
      )}

      {/* Floating Overlay Controls Bar (Bottom of video) */}
      <div
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-2xl bg-surface-base/90 backdrop-blur-md p-3.5 rounded-neo-xl neo-raised border border-white/[0.05] z-30 flex flex-col gap-3 transition-all duration-300 shadow-2xl ${
          showControls || !isPlaying
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {/* Scrubber Progress Bar Area */}
        <div className="flex items-center gap-3 w-full px-2">
          <span ref={currentTimeDisplayRef} className="text-xs font-semibold text-on-surface-variant w-12 text-right">00:00</span>
          
          <div
            ref={scrubBarRef}
            onMouseMove={handleScrubMouseMove}
            onMouseLeave={() => setHoverTime(null)}
            onMouseDown={handleScrubMouseDown}
            className="flex-1 h-3 hover:h-4 neo-pressed rounded-full relative cursor-pointer transition-all duration-150 group/scrubber"
          >
            {/* Hover Time Tooltip */}
            {hoverTime !== null && (
              <div
                style={{ left: `${hoverPosition}%` }}
                className="absolute bottom-6 -translate-x-1/2 z-30 px-2 py-1 bg-surface-base border border-white/[0.05] text-[11px] font-mono font-bold text-on-surface rounded-md shadow-xl pointer-events-none"
              >
                {formatTime(hoverTime)}
              </div>
            )}

            {/* Buffered Range Bar */}
            <div
              ref={bufferedBarRef}
              style={{ width: "0%" }}
              className="absolute top-0 bottom-0 left-0 bg-surface-variant rounded-full transition-all duration-200"
            />

            {/* Played Progress Bar */}
            <div
              ref={playedBarRef}
              style={{ width: "0%" }}
              className="absolute top-0 bottom-0 left-0 bg-glow-indigo rounded-full shadow-[0_0_8px_rgba(129,140,248,0.4)] flex items-center justify-end"
            >
              {/* Scrubber Thumb Knob */}
              <div className="w-3.5 h-3.5 rounded-full bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] scale-0 group-hover/scrubber:scale-100 transition-transform -mr-1.5" />
            </div>
          </div>
          
          <span ref={durationDisplayRef} className="text-xs font-semibold text-on-surface-variant w-12">{formatTime(duration)}</span>
        </div>

        {/* Buttons Controls Bar */}
        <div className="flex items-center justify-between px-2">
          {/* Left Controls (Play, Skip, Volume) */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSkip(-10)}
              className="w-10 h-10 rounded-full neo-button flex items-center justify-center text-on-surface hover:text-primary transition-colors cursor-pointer"
              title="Skip backward 10s (Left Arrow/J)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={togglePlay}
              className="w-14 h-14 rounded-full neo-button-primary flex items-center justify-center cursor-pointer"
              title={isPlaying ? "Pause (Space/K)" : "Play (Space/K)"}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 fill-current ml-1" />
              )}
            </button>

            <button
              onClick={() => handleSkip(10)}
              className="w-10 h-10 rounded-full neo-button flex items-center justify-center text-on-surface hover:text-primary transition-colors cursor-pointer"
              title="Skip forward 10s (Right Arrow/L)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume Control Group */}
            <div className="flex items-center gap-2 ml-4 group/vol hidden sm:flex">
              <button
                onClick={toggleMute}
                className="w-10 h-10 rounded-full neo-button flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
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

              <div className="w-0 group-hover/vol:w-20 sm:w-24 overflow-hidden transition-all duration-200 flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full h-2 neo-pressed rounded-full appearance-none bg-surface-container accent-primary cursor-pointer outline-none"
                  style={{ background: `linear-gradient(to right, #818cf8 ${volume * 100}%, transparent 0)` }}
                />
              </div>
            </div>
          </div>

          {/* Right Controls (Speed, Fullscreen) */}
          <div className="flex items-center gap-2">
            {/* Playback Speed Settings */}
            <div className="relative">
              <button
                onClick={() => setShowSettingsMenu((p) => !p)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  showSettingsMenu ? "neo-pressed text-primary" : "neo-button text-on-surface-variant hover:text-on-surface"
                }`}
                title="Playback Speed"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Speed Popover Menu */}
              {showSettingsMenu && (
                <div className="absolute bottom-full right-0 mb-4 w-36 bg-surface-base border border-outline-variant/15 rounded-neo-lg p-2 neo-card z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="text-[10px] font-bold text-on-surface-variant px-2 py-1 border-b border-outline-variant/15 mb-1 uppercase tracking-wider">
                    Speed
                  </div>
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handleRateChange(rate)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-neo text-xs font-medium transition-all text-left cursor-pointer ${
                        playbackRate === rate
                          ? "bg-primary/10 text-primary neo-pressed font-bold"
                          : "text-on-surface-variant hover:bg-surface-base hover:text-on-surface"
                      }`}
                    >
                      <span>{rate === 1 ? "Normal" : `${rate}x`}</span>
                      {playbackRate === rate && <Check className="w-3.5 h-3.5 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="w-10 h-10 rounded-full neo-button flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
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
