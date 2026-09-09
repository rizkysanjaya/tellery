/**
 * =============================================================================
 * Module: frontend/src/components/ui/FolderColorPicker.tsx
 * Purpose: Hover-triggered 4×4 color palette popover for folder icon customization.
 *          Shows 16 curated stock colors with pro-grade flat obsidian styling.
 * Used by: Sidebar.tsx (album list), FolderGrid.tsx (album cards).
 * Dependencies: React, lucide-react (RotateCcw).
 * Public Members: FolderColorPicker, FOLDER_PALETTE
 * Side Effects: Calls onColorSelect callback when a swatch is clicked.
 * =============================================================================
 */

import React, { useState, useRef, useEffect } from "react";
import { RotateCcw } from "lucide-react";

/** 16 curated palette colors for folder icons — clean, dark-theme friendly. */
export const FOLDER_PALETTE: string[] = [
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#a855f7", // Purple
  "#d946ef", // Fuchsia
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#eab308", // Yellow
  "#84cc16", // Lime
  "#22c55e", // Green
  "#14b8a6", // Teal
  "#06b6d4", // Cyan
  "#0ea5e9", // Sky
  "#64748b", // Slate
];

interface FolderColorPickerProps {
  currentColor: string | null;
  onColorSelect: (color: string | null) => void;
  children: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
}

export const FolderColorPicker: React.FC<FolderColorPickerProps> = ({
  currentColor,
  onColorSelect,
  children,
  placement = "bottom",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const handleSelect = (color: string | null) => {
    onColorSelect(color);
    setIsOpen(false);
  };

  const getPlacementClasses = () => {
    switch (placement) {
      case "top":
        return "bottom-full left-1/2 -translate-x-1/2 mb-2";
      case "left":
        return "right-full top-1/2 -translate-y-1/2 mr-2";
      case "right":
        return "left-full top-1/2 -translate-y-1/2 ml-2";
      case "bottom":
      default:
        return "top-full left-1/2 -translate-x-1/2 mt-2";
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger: the folder icon */}
      <div className="cursor-pointer inline-flex items-center justify-center">
        {children}
      </div>

      {/* Palette Popover */}
      {isOpen && (
        <div
          className={`absolute ${getPlacementClasses()} z-50 p-3 rounded-xl bg-surface-container-low/95 backdrop-blur-md border border-outline-variant/20 shadow-2xl min-w-[152px] animate-in fade-in zoom-in-95 duration-150 select-none`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2 text-center">
            Folder Color
          </div>

          {/* 4×4 Color Grid with generous spacing */}
          <div className="grid grid-cols-4 gap-2">
            {FOLDER_PALETTE.map((color) => {
              const isSelected = currentColor?.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(color);
                  }}
                  className={`w-6 h-6 rounded-full transition-transform duration-150 cursor-pointer hover:scale-125 focus:outline-hidden ${
                    isSelected
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-surface-base scale-110 shadow-md"
                      : "hover:shadow-sm"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              );
            })}
          </div>

          {/* Reset Action */}
          {currentColor && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(null);
              }}
              className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-[11px] font-medium text-on-surface-variant hover:text-on-surface py-1 rounded-lg hover:bg-surface-container-high transition-colors cursor-pointer border-t border-outline-variant/15 pt-2"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Default Color</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
