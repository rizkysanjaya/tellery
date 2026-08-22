/**
 * =============================================================================
 * Module: frontend/src/components/ui/TeleGalleryLogo.tsx
 * Purpose: Custom TeleGallery brand icon combining Telegram origami paper plane
 *          with glowing media gallery aperture and polaroid photo frame.
 * Used by: frontend/src/components/Sidebar.tsx, frontend/src/components/Header.tsx
 * Dependencies: React
 * Public Members: TeleGalleryLogo
 * Side Effects: Pure SVG presentation.
 * =============================================================================
 */

import React from "react";

interface TeleGalleryLogoProps {
  className?: string;
  size?: number;
}

export const TeleGalleryLogo: React.FC<TeleGalleryLogoProps> = ({
  className = "w-8 h-8",
  size = 32,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0 drop-shadow-[0_4px_12px_rgba(99,102,241,0.35)] transition-transform duration-200 hover:scale-105`}
    >
      <defs>
        <linearGradient id="tgPlaneGrad" x1="8" y1="12" x2="56" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="45%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#4338ca" />
        </linearGradient>
        <linearGradient id="tgPhotoGrad" x1="12" y1="16" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="tgApertureGrad" x1="24" y1="24" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>

      {/* Telegram Plane Wing (Back/Shadow Fold) */}
      <path d="M12 32 L52 14 L34 50 L26 38 Z" fill="#312e81" opacity="0.6" />

      {/* Telegram Plane Main Body */}
      <path d="M12 32 L52 14 L38 35 L24 37 Z" fill="url(#tgPlaneGrad)" />
      
      {/* Telegram Plane Bottom Fold */}
      <path d="M24 37 L38 35 L34 50 L28 42 Z" fill="#4338ca" />

      {/* Layered Gallery Photo Frame */}
      <rect
        x="22"
        y="18"
        width="22"
        height="18"
        rx="3.5"
        transform="rotate(-10 33 27)"
        fill="url(#tgPhotoGrad)"
        stroke="#ffffff"
        strokeWidth="1"
        strokeOpacity="0.8"
      />
      
      {/* Photo Graphics inside Frame */}
      <circle cx="36" cy="23" r="2" fill="#38bdf8" />
      <path
        d="M25 32 L31 26 L36 30 L40 25 L43 30"
        fill="none"
        stroke="#4338ca"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Central Media Aperture Lens */}
      <circle cx="33" cy="33" r="7" fill="#0b1326" stroke="url(#tgApertureGrad)" strokeWidth="2" />
      <circle cx="33" cy="33" r="3" fill="#38bdf8" />
    </svg>
  );
};
