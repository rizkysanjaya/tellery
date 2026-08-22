/**
 * =============================================================================
 * Module: frontend/src/components/ui/SpotlightCard.tsx
 * Purpose: 21st.dev spotlight card component that renders a cursor-following radial
 *          gradient beam using direct DOM style updates (0 React state re-renders)
 *          to ensure buttery smooth 60fps scrolling and video playback.
 * Used by: frontend/src/components/MediaCard.tsx, frontend/src/components/FolderGrid.tsx
 * Dependencies: React
 * Public Members: SpotlightCard
 * Side Effects: Mutates local overlay element style directly on mouse movement.
 * =============================================================================
 */

import React, { useRef } from "react";

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  spotlightSize?: number;
}

export const SpotlightCard: React.FC<SpotlightCardProps> = ({
  children,
  className = "",
  spotlightColor = "rgba(14, 165, 233, 0.18)",
  spotlightSize = 350,
  ...props
}) => {
  const spotlightRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!spotlightRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    spotlightRef.current.style.opacity = "1";
    spotlightRef.current.style.background = `radial-gradient(${spotlightSize}px circle at ${x}px ${y}px, ${spotlightColor}, transparent 80%)`;
  };

  const handleMouseLeave = () => {
    if (spotlightRef.current) {
      spotlightRef.current.style.opacity = "0";
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/80 transition-shadow duration-300 ${className}`}
      {...props}
    >
      {/* Dynamic Cursor Spotlight Beam (Zero React re-render overhead) */}
      <div
        ref={spotlightRef}
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 z-10"
      />
      {/* Content wrapper */}
      <div className="relative z-0 h-full w-full">{children}</div>
    </div>
  );
};

