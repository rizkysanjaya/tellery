/**
 * =============================================================================
 * Module: frontend/src/components/ui/LiquidProgressBar.tsx
 * Purpose: Precision liquid fluid progress bar with undulating wave meniscus,
 *          translucent specular sheen, and smooth GPU-accelerated charging physics.
 * Used by: frontend/src/components/Sidebar.tsx,
 *          frontend/src/components/UploadManager.tsx,
 *          frontend/src/components/ui/UndoToast.tsx
 * Dependencies: React
 * Public Members: LiquidProgressBar
 * Side Effects: Pure UI component; renders animated GPU-composited CSS liquid elements.
 * =============================================================================
 */

import React from "react";

export type LiquidColor = "indigo" | "amber" | "error" | "cyan" | "emerald" | "multi";

export interface LiquidProgressBarProps {
  progress: number; // 0 to 100
  height?: string; // Tailwind height class, default "h-2.5"
  color?: LiquidColor;
  className?: string;
  isPulsing?: boolean; // for processing / active spooling state
  showGlow?: boolean;
}

const colorMap: Record<LiquidColor, { bg: string; glow: string; wave1: string; wave2: string }> = {
  indigo: {
    bg: "bg-gradient-to-r from-indigo-600 via-primary to-cyan-400",
    glow: "shadow-[0_0_12px_rgba(99,102,241,0.5)]",
    wave1: "rgba(255, 255, 255, 0.28)",
    wave2: "rgba(165, 180, 252, 0.35)",
  },
  amber: {
    bg: "bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-300",
    glow: "shadow-[0_0_12px_rgba(245,158,11,0.5)]",
    wave1: "rgba(255, 255, 255, 0.3)",
    wave2: "rgba(253, 230, 138, 0.35)",
  },
  error: {
    bg: "bg-gradient-to-r from-red-600 via-rose-500 to-amber-400",
    glow: "shadow-[0_0_12px_rgba(239,68,68,0.5)]",
    wave1: "rgba(255, 255, 255, 0.3)",
    wave2: "rgba(254, 205, 211, 0.35)",
  },
  cyan: {
    bg: "bg-gradient-to-r from-teal-500 via-cyan-400 to-sky-300",
    glow: "shadow-[0_0_12px_rgba(6,182,212,0.5)]",
    wave1: "rgba(255, 255, 255, 0.3)",
    wave2: "rgba(165, 243, 252, 0.35)",
  },
  emerald: {
    bg: "bg-gradient-to-r from-emerald-600 via-emerald-400 to-teal-300",
    glow: "shadow-[0_0_12px_rgba(16,185,129,0.5)]",
    wave1: "rgba(255, 255, 255, 0.3)",
    wave2: "rgba(167, 243, 208, 0.35)",
  },
  multi: {
    bg: "bg-gradient-to-r from-violet-600 via-primary to-cyan-400",
    glow: "shadow-[0_0_14px_rgba(129,140,248,0.55)]",
    wave1: "rgba(255, 255, 255, 0.32)",
    wave2: "rgba(199, 210, 254, 0.4)",
  },
};

export const LiquidProgressBar: React.FC<LiquidProgressBarProps> = ({
  progress,
  height = "h-2.5",
  color = "indigo",
  className = "",
  isPulsing = false,
  showGlow = true,
}) => {
  const clampedProgress = Math.max(0, Math.min(100, progress));
  const activeColor = colorMap[color] || colorMap.indigo;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-full bg-surface-container-lowest border border-outline-variant/20 shadow-inner ${height} ${className}`}
    >
      {/* Liquid Column */}
      <div
        style={{ width: `${clampedProgress}%` }}
        className={`relative h-full rounded-full transition-all duration-300 ease-out overflow-hidden ${
          activeColor.bg
        } ${showGlow ? activeColor.glow : ""} ${isPulsing ? "animate-pulse" : ""}`}
      >
        {/* Seamless 2.25s Undulating Wave Layer */}
        {clampedProgress > 0 && (
          <div
            className="absolute inset-0 flex w-[200%] pointer-events-none"
            style={{
              animation: "liquid-wave-slide 2.25s linear infinite",
            }}
          >
            {/* Repeated Wave Segment A */}
            <svg
              viewBox="0 0 100 20"
              preserveAspectRatio="none"
              className="w-1/2 h-full shrink-0 opacity-70"
            >
              <path
                d="M 0 10 Q 25 2, 50 10 T 100 10 L 100 20 L 0 20 Z"
                fill={activeColor.wave1}
              />
              <path
                d="M 0 10 Q 25 18, 50 10 T 100 10 L 100 20 L 0 20 Z"
                fill={activeColor.wave2}
                opacity="0.6"
              />
            </svg>

            {/* Repeated Wave Segment B (Seamless loop join) */}
            <svg
              viewBox="0 0 100 20"
              preserveAspectRatio="none"
              className="w-1/2 h-full shrink-0 opacity-70"
            >
              <path
                d="M 0 10 Q 25 2, 50 10 T 100 10 L 100 20 L 0 20 Z"
                fill={activeColor.wave1}
              />
              <path
                d="M 0 10 Q 25 18, 50 10 T 100 10 L 100 20 L 0 20 Z"
                fill={activeColor.wave2}
                opacity="0.6"
              />
            </svg>
          </div>
        )}

        {/* Specular Liquid Top Sheen (Simulates glass volume) */}
        <div className="absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-white/35 via-white/10 to-transparent pointer-events-none rounded-t-full" />

        {/* Dynamic Leading Meniscus Bead (Surface tension meniscus) */}
        {clampedProgress > 3 && clampedProgress < 98 && (
          <div className="absolute right-0 top-0 bottom-0 w-2.5 rounded-full bg-white/50 blur-[0.8px] pointer-events-none animate-pulse" />
        )}
      </div>
    </div>
  );
};
