/**
 * =============================================================================
 * Module: frontend/src/components/VideoPlayer.tsx
 * Purpose: Top-tier custom dark studio video player with custom scrubber, hover time badge,
 *          buffered range tracking, playback speed controls, picture-in-picture,
 *          custom right-click context menu (Loop, Speed, PiP, URL copy, Stats for Nerds),
 *          keyboard shortcuts (YouTube/Netflix style), and auto-hiding controls.
 *          Updated with mobile touch target hit slop and touch scrubbing.
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
  Repeat,
  Link,
  Activity,
  Gauge,
  Download,
  ExternalLink,
  X,
} from "lucide-react";
import { MediaItem } from "../types";
import { updateMediaMetadata } from "../api";

interface VideoPlayerProps {
  item: MediaItem;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ item }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafScrubRef = useRef<number | null>(null);
  const scrubBarRef = useRef<HTMLDivElement>(null);
  const playedBarRef = useRef<HTMLDivElement>(null);
  const bufferedBarRef = useRef<HTMLDivElement>(null);
  const currentTimeDisplayRef = useRef<HTMLSpanElement>(null);
  const durationDisplayRef = useRef<HTMLSpanElement>(null);
  const hideControlsTimerRef = useRef<number | null>(null);

  // Playback States (macro states only - 0 re-renders during playback)
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
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

  const isAnimation = Boolean(
    item.is_animation ||
    item.mime_type === "image/gif" ||
    item.file_name.toLowerCase().endsWith(".gif") ||
    item.file_name.toLowerCase().includes(".gif.mp4") ||
    (item.mime_type.startsWith("video/") && (item.duration_seconds || 0) <= 15 && item.file_name.toLowerCase().includes("gif"))
  );

  // Context Menu & Advanced Options States
  const [isLooping, setIsLooping] = useState(() => isAnimation || localStorage.getItem("telegallery_video_loop") === "true");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showSpeedSubmenu, setShowSpeedSubmenu] = useState(false);
  const [showStatsOverlay, setShowStatsOverlay] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

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

  // Close context menu on outside click or scroll
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setShowSpeedSubmenu(false);
      }
    };
    if (contextMenu) {
      window.addEventListener("mousedown", handleOutsideClick);
      window.addEventListener("scroll", () => setContextMenu(null), true);
    }
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [contextMenu]);

  // Reset states on item change
  useEffect(() => {
    setIsLoading(true);
    setIsPlaying(false);
    setIsEnded(false);
    setHasError(false);
    setContextMenu(null);
    setShowSpeedSubmenu(false);
    if (isAnimation) setIsLooping(true);
    setDuration(item.duration_seconds || 0);
    if (playedBarRef.current) playedBarRef.current.style.width = "0%";
    if (bufferedBarRef.current) bufferedBarRef.current.style.width = "0%";
    if (currentTimeDisplayRef.current) currentTimeDisplayRef.current.textContent = "00:00";
    if (durationDisplayRef.current) durationDisplayRef.current.textContent = formatTime(item.duration_seconds || 0);
  }, [item.id, item.stream_url, item.duration_seconds, isAnimation]);

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

  // Replay from beginning when video ends
  const handleReplay = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    videoRef.current
      .play()
      .then(() => {
        setIsEnded(false);
        setIsPlaying(true);
        setCenterRipple("play");
        setTimeout(() => setCenterRipple(null), 500);
      })
      .catch((err) => console.error("Replay error:", err));
    resetHideTimer();
  }, [resetHideTimer]);

  // Toggle Play / Pause with ripple animation
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;

    if (isEnded || videoRef.current.ended) {
      handleReplay();
      return;
    }

    if (videoRef.current.paused) {
      videoRef.current
        .play()
        .then(() => {
          setIsEnded(false);
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
  }, [isEnded, handleReplay, resetHideTimer]);

  const handleSkip = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    setIsEnded(false);
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

  const toggleLoop = () => {
    setIsLooping((prev) => {
      const next = !prev;
      localStorage.setItem("telegallery_video_loop", String(next));
      return next;
    });
    setContextMenu(null);
  };

  const handleCopyVideoUrl = () => {
    const fullUrl = window.location.origin + item.stream_url;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2000);
    });
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const menuWidth = 230;
    const menuHeight = 320;
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const x = Math.min(Math.max(10, rawX), rect.width - menuWidth - 10);
    const y = Math.min(Math.max(10, rawY), rect.height - menuHeight - 10);
    setContextMenu({ x, y });
    setShowSpeedSubmenu(false);
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
  const handleProgress = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration || duration || 0;
    if (bufferedBarRef.current && videoRef.current.buffered.length > 0 && dur > 0) {
      const cur = videoRef.current.currentTime;
      let bufferEnd = 0;
      for (let i = 0; i < videoRef.current.buffered.length; i++) {
        if (
          videoRef.current.buffered.start(i) <= cur + 0.5 &&
          videoRef.current.buffered.end(i) >= cur
        ) {
          bufferEnd = videoRef.current.buffered.end(i);
          break;
        }
      }
      if (bufferEnd === 0 && videoRef.current.buffered.length > 0) {
        bufferEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      }
      bufferedBarRef.current.style.width = `${Math.min(100, (bufferEnd / dur) * 100)}%`;
    }
  };

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
    handleProgress();
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      const vW = videoRef.current.videoWidth;
      const vH = videoRef.current.videoHeight;
      setDuration(dur);
      if (durationDisplayRef.current) {
        durationDisplayRef.current.textContent = formatTime(dur);
      }
      setIsLoading(false);

      // Auto-capture and persist missing duration or dimensions to catalog
      if (dur > 0 && (!item.duration_seconds || item.duration_seconds === 0 || !item.width || !item.height)) {
        item.duration_seconds = dur;
        if (vW && vH) {
          item.width = vW;
          item.height = vH;
        }
        updateMediaMetadata(item.id, {
          duration_seconds: dur,
          width: vW || undefined,
          height: vH || undefined,
        });
      }
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
    const targetHoverTime = ratio * (duration || 1);
    setHoverPosition(ratio * 100);
    setHoverTime(targetHoverTime);
  };

  const handleScrubMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const targetTime = calculateScrubTime(e);
    isScrubbingRef.current = true;
    if (videoRef.current) {
      const vid = videoRef.current as HTMLVideoElement & { fastSeek?: (t: number) => void };
      if (typeof vid.fastSeek === "function") {
        vid.fastSeek(targetTime);
      } else {
        vid.currentTime = targetTime;
      }
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

      if (rafScrubRef.current) {
        cancelAnimationFrame(rafScrubRef.current);
      }

      rafScrubRef.current = requestAnimationFrame(() => {
        if (!videoRef.current) return;
        const vid = videoRef.current as HTMLVideoElement & { fastSeek?: (t: number) => void };
        if (typeof vid.fastSeek === "function") {
          vid.fastSeek(newTime);
        } else {
          vid.currentTime = newTime;
        }
        if (playedBarRef.current) {
          playedBarRef.current.style.width = `${ratio * 100}%`;
        }
        if (currentTimeDisplayRef.current) {
          currentTimeDisplayRef.current.textContent = formatTime(newTime);
        }
      });
    };

    const onMouseUp = () => {
      isScrubbingRef.current = false;
      if (rafScrubRef.current) {
        cancelAnimationFrame(rafScrubRef.current);
      }
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      resetHideTimer();
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleScrubTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!e.touches[0] || !scrubBarRef.current || !videoRef.current) return;
    const touch = e.touches[0];
    const rect = scrubBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const targetTime = ratio * (videoRef.current.duration || duration || 1);
    isScrubbingRef.current = true;
    const vid = videoRef.current as HTMLVideoElement & { fastSeek?: (t: number) => void };
    if (typeof vid.fastSeek === "function") {
      vid.fastSeek(targetTime);
    } else {
      vid.currentTime = targetTime;
    }
    const dur = videoRef.current.duration || duration || 1;
    if (playedBarRef.current) {
      playedBarRef.current.style.width = `${(targetTime / dur) * 100}%`;
    }
    if (currentTimeDisplayRef.current) {
      currentTimeDisplayRef.current.textContent = formatTime(targetTime);
    }

    const onTouchMove = (moveEvent: TouchEvent) => {
      if (!moveEvent.touches[0] || !scrubBarRef.current || !videoRef.current) return;
      const moveTouch = moveEvent.touches[0];
      const r = scrubBarRef.current.getBoundingClientRect();
      const rat = Math.max(0, Math.min(1, (moveTouch.clientX - r.left) / r.width));
      const d = videoRef.current.duration || duration || 1;
      const newT = rat * d;

      if (rafScrubRef.current) {
        cancelAnimationFrame(rafScrubRef.current);
      }

      rafScrubRef.current = requestAnimationFrame(() => {
        if (!videoRef.current) return;
        const v = videoRef.current as HTMLVideoElement & { fastSeek?: (t: number) => void };
        if (typeof v.fastSeek === "function") {
          v.fastSeek(newT);
        } else {
          v.currentTime = newT;
        }
        if (playedBarRef.current) {
          playedBarRef.current.style.width = `${rat * 100}%`;
        }
        if (currentTimeDisplayRef.current) {
          currentTimeDisplayRef.current.textContent = formatTime(newT);
        }
      });
    };

    const onTouchEnd = () => {
      isScrubbingRef.current = false;
      if (rafScrubRef.current) {
        cancelAnimationFrame(rafScrubRef.current);
      }
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      resetHideTimer();
    };

    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
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
      onContextMenu={handleContextMenu}
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
        autoPlay={isAnimation}
        loop={isLooping || isAnimation}
        preload="auto"
        onClick={togglePlay}
        onContextMenu={handleContextMenu}
        onTimeUpdate={handleTimeUpdate}
        onProgress={handleProgress}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadedData={() => setIsLoading(false)}
        onCanPlay={() => {
          setIsLoading(false);
          if (isAnimation && videoRef.current && videoRef.current.paused) {
            videoRef.current.muted = true;
            videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
          }
        }}
        onCanPlayThrough={() => setIsLoading(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => {
          setIsPlaying(true);
          setIsEnded(false);
          setIsLoading(false);
        }}
        onPause={() => {
          setIsPlaying(false);
          setIsLoading(false);
        }}
        onEnded={() => {
          if (isLooping) {
            handleReplay();
            return;
          }
          setIsPlaying(false);
          setIsEnded(true);
          setIsLoading(false);
          setShowControls(true);
        }}
        onError={(e) => {
          console.error("Video error:", e);
          setIsLoading(false);
          setHasError(true);
        }}
        className="w-full h-full max-h-[88vh] object-contain cursor-pointer"
      />

      {/* Center Big Replay Button Overlay when Video Ends */}
      {isEnded && !isLoading && !hasError && (
        <button
          onClick={handleReplay}
          className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-surface-base/90 hover:bg-surface-base backdrop-blur-md border border-white/15 flex items-center justify-center neo-button shadow-[0_0_35px_rgba(129,140,248,0.5)] text-primary hover:scale-110 active:scale-95 transition-all z-20 cursor-pointer group/replay animate-in fade-in zoom-in-75 duration-200"
          title="Replay Video (Space / Click)"
        >
          <RotateCcw className="w-10 h-10 text-primary group-hover/replay:-rotate-90 transition-transform duration-300 drop-shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
        </button>
      )}

      {/* Center Big Play Button Overlay when Paused */}
      {!isPlaying && !isEnded && !isLoading && !hasError && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 m-auto w-20 h-20 rounded-full bg-surface-base/80 hover:bg-surface-base backdrop-blur-md border border-white/10 flex items-center justify-center neo-button shadow-[0_0_30px_rgba(0,0,0,0.6)] text-primary hover:scale-110 active:scale-95 transition-all z-20 cursor-pointer"
          title="Play Video"
        >
          <Play className="w-10 h-10 fill-primary text-primary ml-1" />
        </button>
      )}

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
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2.5rem)] max-w-2xl bg-surface-base/95 backdrop-blur-xl p-3 sm:p-3.5 rounded-2xl neo-raised border border-outline-variant/30 z-30 flex flex-col gap-2.5 transition-all duration-300 shadow-[0_16px_40px_rgba(0,0,0,0.5)] ${
          showControls || !isPlaying
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        {/* Row 1: Full-Width Scrubber Progress Bar */}
        <div className="w-full px-1 py-1.5 -my-1.5 touch-manipulation">
          <div
            ref={scrubBarRef}
            onMouseMove={handleScrubMouseMove}
            onMouseLeave={() => setHoverTime(null)}
            onMouseDown={handleScrubMouseDown}
            onTouchStart={handleScrubTouchStart}
            className="w-full h-2 hover:h-3 neo-pressed rounded-full relative cursor-pointer transition-all duration-150 group/scrubber flex items-center touch-manipulation"
          >
            {/* Scrubber Hover Time Tooltip */}
            {hoverTime !== null && (
              <div
                style={{ left: `${Math.max(5, Math.min(95, hoverPosition))}%` }}
                className="absolute bottom-5 -translate-x-1/2 z-30 flex items-center px-2.5 py-1 bg-surface-base/98 border border-outline-variant/30 rounded-neo shadow-lg pointer-events-none animate-in fade-in duration-100"
              >
                <span className="text-[11px] font-mono font-bold text-primary">
                  {formatTime(hoverTime)}
                </span>
              </div>
            )}

            {/* Buffered Range Bar */}
            <div
              ref={bufferedBarRef}
              style={{ width: "0%" }}
              className="absolute top-0 bottom-0 left-0 bg-surface-variant/80 rounded-full transition-all duration-200"
            />

            {/* Played Progress Bar */}
            <div
              ref={playedBarRef}
              style={{ width: "0%" }}
              className="absolute top-0 bottom-0 left-0 bg-glow-indigo rounded-full shadow-[0_0_10px_rgba(129,140,248,0.5)] flex items-center justify-end"
            >
              {/* Scrubber Thumb Knob */}
              <div className="w-3.5 h-3.5 rounded-full bg-white shadow-md ring-2 ring-primary scale-0 group-hover/scrubber:scale-100 transition-transform -mr-1.5" />
            </div>
          </div>
        </div>

        {/* Row 2: Unified Controls Toolbar */}
        <div className="flex items-center justify-between gap-3 px-1">
          {/* Left: Playback & Volume & Timestamp */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full neo-button-primary flex items-center justify-center cursor-pointer active:scale-95 transition-transform shrink-0 shadow-md touch-manipulation"
              title={isPlaying ? "Pause (Space/K)" : "Play (Space/K)"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Skip Backward 10s */}
            <button
              onClick={() => handleSkip(-10)}
              className="w-9 h-9 min-w-[36px] min-h-[36px] relative after:absolute after:-inset-1.5 after:content-[''] rounded-full neo-button flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer shrink-0 touch-manipulation"
              title="Skip backward 10s (Left Arrow/J)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Skip Forward 10s */}
            <button
              onClick={() => handleSkip(10)}
              className="w-9 h-9 min-w-[36px] min-h-[36px] relative after:absolute after:-inset-1.5 after:content-[''] rounded-full neo-button flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer shrink-0 touch-manipulation"
              title="Skip forward 10s (Right Arrow/L)"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume Control Group */}
            <div className="flex items-center gap-1.5 ml-1 group/vol">
              <button
                onClick={toggleMute}
                className="w-9 h-9 min-w-[36px] min-h-[36px] relative after:absolute after:-inset-1.5 after:content-[''] rounded-full neo-button flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shrink-0 touch-manipulation"
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

              {/* Custom Interactive Volume Slider (Zero native thumb artifacts) */}
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  const target = e.currentTarget;
                  const rect = target.getBoundingClientRect();
                  const updateVol = (clientX: number) => {
                    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                    handleVolumeChange(ratio);
                  };
                  updateVol(e.clientX);

                  const onMouseMove = (moveE: MouseEvent) => {
                    updateVol(moveE.clientX);
                  };
                  const onMouseUp = () => {
                    window.removeEventListener("mousemove", onMouseMove);
                    window.removeEventListener("mouseup", onMouseUp);
                  };
                  window.addEventListener("mousemove", onMouseMove);
                  window.addEventListener("mouseup", onMouseUp);
                }}
                className="w-16 sm:w-20 h-5 flex items-center cursor-pointer select-none group/slider"
                title={`Volume: ${isMuted || volume === 0 ? 0 : Math.round(volume * 100)}%`}
              >
                <div className="w-full h-1.5 bg-outline-variant/30 rounded-full relative overflow-hidden">
                  {/* Active Volume Level Fill */}
                  <div
                    style={{ width: `${isMuted || volume === 0 ? 0 : volume * 100}%` }}
                    className="absolute top-0 bottom-0 left-0 bg-glow-indigo rounded-full shadow-[0_0_6px_rgba(129,140,248,0.5)] transition-all duration-75"
                  />
                </div>
              </div>
            </div>

            {/* Live Timestamp (Current / Total) */}
            <div className="hidden sm:flex items-center gap-1 text-xs font-mono font-medium text-on-surface-variant ml-2 select-none">
              <span ref={currentTimeDisplayRef} className="text-on-surface font-semibold">00:00</span>
              <span className="opacity-40">/</span>
              <span ref={durationDisplayRef}>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Actions (Loop, Speed Popover, Fullscreen) */}
          <div className="flex items-center gap-1.5">
            {/* Loop Toggle */}
            <button
              onClick={toggleLoop}
              className={`w-9 h-9 min-w-[36px] min-h-[36px] relative after:absolute after:-inset-1.5 after:content-[''] rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 touch-manipulation ${
                isLooping
                  ? "neo-pressed text-primary ring-1 ring-primary/40 bg-primary/10"
                  : "neo-button text-on-surface-variant hover:text-on-surface"
              }`}
              title={isLooping ? "Loop Enabled" : "Loop Disabled"}
            >
              <Repeat className="w-4 h-4" />
            </button>

            {/* Playback Speed Popover */}
            <div className="relative">
              <button
                onClick={() => setShowSettingsMenu((p) => !p)}
                className={`h-9 px-2.5 min-h-[36px] relative after:absolute after:-inset-1 after:content-[''] rounded-full flex items-center gap-1 text-xs font-mono font-semibold transition-all cursor-pointer shrink-0 touch-manipulation ${
                  showSettingsMenu || playbackRate !== 1
                    ? "neo-pressed text-primary ring-1 ring-primary/40 bg-primary/10"
                    : "neo-button text-on-surface-variant hover:text-on-surface"
                }`}
                title="Playback Speed"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>{playbackRate === 1 ? "1x" : `${playbackRate}x`}</span>
              </button>

              {/* Speed Popover Menu */}
              {showSettingsMenu && (
                <div className="absolute bottom-full right-0 mb-3 w-36 bg-surface-base border border-outline-variant/20 rounded-neo-xl p-1.5 neo-card shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="text-[10px] font-bold text-on-surface-variant px-2.5 py-1 border-b border-outline-variant/15 mb-1 uppercase tracking-wider">
                    Playback Speed
                  </div>
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handleRateChange(rate)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-neo text-xs font-medium transition-all text-left cursor-pointer touch-manipulation ${
                        playbackRate === rate
                          ? "bg-primary/15 text-primary neo-pressed font-bold"
                          : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                      }`}
                    >
                      <span>{rate === 1 ? "Normal (1x)" : `${rate}x`}</span>
                      {playbackRate === rate && <Check className="w-3.5 h-3.5 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="w-9 h-9 min-w-[36px] min-h-[36px] relative after:absolute after:-inset-1.5 after:content-[''] rounded-full neo-button flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer shrink-0 touch-manipulation"
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

      {/* Player Custom Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          className="absolute z-50 w-56 bg-surface-base border border-outline-variant/20 rounded-neo-xl p-1.5 neo-card shadow-[0_10px_35px_rgba(0,0,0,0.7)] animate-in fade-in zoom-in-95 duration-100 select-none text-xs"
        >
          {/* Loop Toggle */}
          <button
            onClick={toggleLoop}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-neo transition-all cursor-pointer ${
              isLooping
                ? "bg-primary/10 text-primary font-bold neo-pressed"
                : "text-on-surface hover:bg-surface-container"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Repeat className={`w-4 h-4 ${isLooping ? "text-primary" : "text-on-surface-variant"}`} />
              <span>Loop Video</span>
            </div>
            {isLooping ? (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-primary/20 text-primary font-mono font-bold">ON</span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface-container text-on-surface-variant font-mono">OFF</span>
            )}
          </button>

          {/* Play / Pause Toggle */}
          <button
            onClick={() => {
              togglePlay();
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-neo text-on-surface hover:bg-surface-container transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              {isPlaying ? (
                <Pause className="w-4 h-4 text-on-surface-variant" />
              ) : (
                <Play className="w-4 h-4 text-primary fill-primary" />
              )}
              <span>{isPlaying ? "Pause" : "Play"}</span>
            </div>
            <span className="text-[10px] text-on-surface-variant font-mono">Space</span>
          </button>

          {/* Speed Submenu Item */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedSubmenu((p) => !p)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-neo transition-all cursor-pointer ${
                showSpeedSubmenu ? "bg-surface-container text-primary" : "text-on-surface hover:bg-surface-container"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Gauge className="w-4 h-4 text-on-surface-variant" />
                <span>Speed</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-surface-container text-primary font-bold font-mono">
                {playbackRate === 1 ? "Normal" : `${playbackRate}x`}
              </span>
            </button>

            {/* Speed Inline Grid */}
            {showSpeedSubmenu && (
              <div className="my-1 p-1 bg-surface-container-lowest rounded-neo grid grid-cols-3 gap-1">
                {PLAYBACK_RATES.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => {
                      handleRateChange(rate);
                      setContextMenu(null);
                    }}
                    className={`py-1 px-1 rounded text-[11px] font-mono text-center transition-all cursor-pointer ${
                      playbackRate === rate
                        ? "bg-primary text-on-primary font-bold"
                        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                    }`}
                  >
                    {rate === 1 ? "1x" : `${rate}x`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="my-1 border-t border-outline-variant/15" />

          {/* Picture in Picture */}
          <button
            onClick={() => {
              togglePiP();
              setContextMenu(null);
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-neo text-on-surface hover:bg-surface-container transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <ExternalLink className="w-4 h-4 text-on-surface-variant" />
              <span>Picture in Picture</span>
            </div>
            <span className="text-[10px] text-on-surface-variant font-mono">P</span>
          </button>

          {/* Copy Video Stream Link */}
          <button
            onClick={handleCopyVideoUrl}
            className="w-full flex items-center justify-between px-3 py-2 rounded-neo text-on-surface hover:bg-surface-container transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Link className="w-4 h-4 text-on-surface-variant" />
              <span>Copy Video URL</span>
            </div>
          </button>

          {/* Stats for Nerds Toggle */}
          <button
            onClick={() => {
              setShowStatsOverlay((prev) => !prev);
              setContextMenu(null);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-neo transition-all cursor-pointer ${
              showStatsOverlay
                ? "bg-primary/10 text-primary font-bold neo-pressed"
                : "text-on-surface hover:bg-surface-container"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-on-surface-variant" />
              <span>Stats for Nerds</span>
            </div>
            {showStatsOverlay && <Check className="w-3.5 h-3.5 text-primary" />}
          </button>

          <div className="my-1 border-t border-outline-variant/15" />

          {/* Download Video */}
          <a
            href={item.stream_url}
            download={item.file_name}
            onClick={() => setContextMenu(null)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-neo text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all cursor-pointer"
          >
            <Download className="w-4 h-4 text-on-surface-variant" />
            <span>Download Video</span>
          </a>
        </div>
      )}

      {/* Stats for Nerds HUD Overlay */}
      {showStatsOverlay && (
        <div className="absolute top-4 left-4 z-40 bg-surface-base/95 backdrop-blur-md border border-outline-variant/30 rounded-neo-lg p-3 text-[11px] font-mono text-on-surface shadow-2xl space-y-1.5 min-w-[270px] neo-card animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-1.5 border-b border-outline-variant/20 text-primary font-sans font-bold text-xs">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              <span>Stats for Nerds</span>
            </div>
            <button
              onClick={() => setShowStatsOverlay(false)}
              className="p-1 rounded-full hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Item ID:</span>
            <span className="text-on-surface font-semibold">#{item.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Resolution:</span>
            <span className="text-on-surface font-semibold">
              {item.width && item.height ? `${item.width}×${item.height}` : "Auto"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Duration:</span>
            <span className="text-on-surface font-semibold">{formatTime(duration)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Format:</span>
            <span className="text-primary font-semibold uppercase">{item.mime_type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">File Size:</span>
            <span className="text-on-surface font-semibold">{(item.file_size / (1024 * 1024)).toFixed(2)} MB</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Speed:</span>
            <span className="text-on-surface font-semibold">{playbackRate}x</span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Looping:</span>
            <span className={isLooping ? "text-emerald-500 font-bold" : "text-on-surface-variant"}>
              {isLooping ? "Active" : "Off"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-on-surface-variant">Volume:</span>
            <span className="text-on-surface font-semibold">{Math.round(volume * 100)}% {isMuted ? "(Muted)" : ""}</span>
          </div>
        </div>
      )}

      {/* Copied URL Toast */}
      {copiedToast && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-surface-base/95 border border-primary/30 rounded-full neo-card text-xs font-semibold text-primary shadow-xl flex items-center gap-2 animate-in fade-in duration-150">
          <Check className="w-4 h-4 text-primary" />
          <span>Video stream URL copied to clipboard!</span>
        </div>
      )}
    </div>
  );
};
