/**
 * =============================================================================
 * Module: frontend/src/components/ui/AuroraBackground.tsx
 * Purpose: Simple neomorphic dark background wrapper for Silk Cloud design system.
 * Used by: frontend/src/App.tsx
 * Dependencies: React
 * Public Members: AuroraBackground
 * Side Effects: Renders static ambient backdrop behind all gallery content.
 * =============================================================================
 */

import React from "react";

interface AuroraBackgroundProps {
  children?: React.ReactNode;
  className?: string;
}

export const AuroraBackground: React.FC<AuroraBackgroundProps> = ({
  children,
  className = "",
}) => {
  return (
    <div className={`relative min-h-screen w-full bg-background text-on-surface overflow-x-hidden ${className}`}>
      {/* Foreground Content Container */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

