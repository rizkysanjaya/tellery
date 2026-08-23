/**
 * =============================================================================
 * Module: frontend/src/components/ui/AuroraBackground.tsx
 * Purpose: High-performance 21st.dev dark ambient backdrop with zero-cost GPU-composited
 *          radial mesh gradients. Provides deep dark aesthetics without CPU/GPU animation jank.
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
    <div className={`relative min-h-screen w-full bg-zinc-950 text-zinc-100 overflow-x-hidden ${className}`}>
      {/* High-Performance Fixed Ambient Gradient Canvas (0% GPU/CPU overhead) */}
      <div
        className="fixed inset-0 pointer-events-none z-0 select-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 15% 0%, rgba(14, 165, 233, 0.08) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 85% 15%, rgba(99, 102, 241, 0.05) 0%, transparent 50%),
            radial-gradient(ellipse 70% 50% at 50% 100%, rgba(14, 165, 233, 0.04) 0%, transparent 60%),
            #09090b
          `,
        }}
      />

      {/* Foreground Content Container */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

