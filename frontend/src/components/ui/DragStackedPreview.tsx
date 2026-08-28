/**
 * =============================================================================
 * Module: frontend/src/components/ui/DragStackedPreview.tsx
 * Purpose: Interactive stacked card deck drag preview with multi-item count badge,
 *          tracking the cursor at 60fps while suppressing redundant browser drag ghosts.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: DragStackedPreview, emptyDragImage
 * Side Effects: Subscribes to window dragover/mousemove events during active drag.
 * =============================================================================
 */

import React, { useEffect, useState } from "react";
import { Image as ImageIcon, Film } from "lucide-react";
import { MediaItem } from "../../types";

export const emptyDragImage = typeof window !== "undefined" ? new Image() : null;
if (emptyDragImage) {
  emptyDragImage.src =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
}

interface DragStackedPreviewProps {
  isDragging: boolean;
  draggedItem: MediaItem | null;
  draggedCount: number;
}

export const DragStackedPreview: React.FC<DragStackedPreviewProps> = ({
  isDragging,
  draggedItem,
  draggedCount,
}) => {
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: -1000, y: -1000 });

  useEffect(() => {
    if (!isDragging) return;

    const handleDragOver = (e: DragEvent) => {
      if (e.clientX || e.clientY) {
        setPos({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      setPos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("dragover", handleDragOver, { passive: true });
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isDragging]);

  if (!isDragging || !draggedItem || pos.x < 0) {
    return null;
  }

  const isVideo = draggedItem.mime_type?.startsWith("video/");

  return (
    <div
      style={{
        transform: `translate3d(${pos.x + 12}px, ${pos.y + 12}px, 0)`,
      }}
      className="fixed top-0 left-0 z-[99999] pointer-events-none select-none will-change-transform"
    >
      <div className="relative flex items-center justify-center">
        {/* Stack Layer 3 (for 3+ items) */}
        {draggedCount >= 3 && (
          <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-surface-container-high border border-outline-variant/40 shadow-md rotate-6 translate-x-2 translate-y-1.5 opacity-60" />
        )}

        {/* Stack Layer 2 (for 2+ items) */}
        {draggedCount >= 2 && (
          <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-surface-container border border-outline-variant/50 shadow-lg -rotate-4 -translate-x-1.5 translate-y-1 opacity-85" />
        )}

        {/* Main Top Card */}
        <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-surface-base border-2 border-primary/60 shadow-[0_12px_28px_rgba(0,0,0,0.45)] flex items-center justify-center">
          {draggedItem.thumbnail_url ? (
            <img
              src={draggedItem.thumbnail_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : isVideo ? (
            <div className="w-full h-full flex items-center justify-center bg-surface-container text-primary">
              <Film className="w-7 h-7" />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-surface-container text-primary">
              <ImageIcon className="w-7 h-7" />
            </div>
          )}
        </div>

        {/* Dynamic Multi-Item Count Badge */}
        {draggedCount > 1 && (
          <div className="absolute -top-2.5 -right-2.5 px-2 py-0.5 min-w-[24px] h-6 rounded-full bg-primary text-on-primary text-xs font-bold font-mono shadow-xl ring-2 ring-surface-base flex items-center justify-center animate-in zoom-in-75 duration-150">
            {draggedCount}
          </div>
        )}
      </div>
    </div>
  );
};
