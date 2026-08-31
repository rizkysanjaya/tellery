/**
 * =============================================================================
 * Module: frontend/src/components/TimelineDateScrubber.tsx
 * Purpose: Apple/Google Photos-inspired chronological date-jump scrubber bar
 *          with floating month preview bubble, scroll-synchronized active indicator,
 *          and 1-click smooth jump navigation.
 * Used by: frontend/src/components/TimelineGrid.tsx, frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: TimelineDateScrubber
 * Side Effects: Reads DOM bounding boxes, observes intersection entries, scrolls window.
 * =============================================================================
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Calendar, ChevronUp, ChevronDown } from "lucide-react";
import { TimelineGroup } from "../types";

interface TimelineDateScrubberProps {
  groups: TimelineGroup[];
  activeGroupKey?: string;
  onJumpToDate?: (periodKey: string) => void;
}

export const TimelineDateScrubber: React.FC<TimelineDateScrubberProps> = ({
  groups,
  activeGroupKey,
  onJumpToDate,
}) => {
  const [activeKey, setActiveKey] = useState<string>(activeGroupKey || "");
  const [hoveredGroup, setHoveredGroup] = useState<TimelineGroup | null>(null);
  const [tooltipPos, setTooltipPos] = useState<number>(0);
  const scrubberRef = useRef<HTMLDivElement>(null);

  if (!groups || groups.length <= 1) {
    return null;
  }

  // Synchronize active section using IntersectionObserver
  useEffect(() => {
    if (typeof window === "undefined" || groups.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            if (id.startsWith("timeline-group-")) {
              const key = id.replace("timeline-group-", "");
              setActiveKey(key);
            }
          }
        }
      },
      {
        rootMargin: "-80px 0px -70% 0px",
        threshold: 0.05,
      }
    );

    groups.forEach((group) => {
      const el = document.getElementById(`timeline-group-${group.period_key}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [groups]);

  // Jump to section with smooth scroll
  const handleJump = useCallback(
    (group: TimelineGroup) => {
      setActiveKey(group.period_key);
      if (onJumpToDate) {
        onJumpToDate(group.period_key);
      }
      const el = document.getElementById(`timeline-group-${group.period_key}`);
      if (el) {
        const yOffset = -80;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    },
    [onJumpToDate]
  );

  const handleMouseEnterItem = (e: React.MouseEvent<HTMLButtonElement>, group: TimelineGroup) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (scrubberRef.current) {
      const parentRect = scrubberRef.current.getBoundingClientRect();
      setTooltipPos(rect.top - parentRect.top + rect.height / 2);
    }
    setHoveredGroup(group);
  };

  const handleMouseLeave = () => {
    setHoveredGroup(null);
  };

  return (
    <div
      ref={scrubberRef}
      onMouseLeave={handleMouseLeave}
      className="fixed right-3.5 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-center select-none"
    >
      {/* Floating Date Preview Tooltip Bubble */}
      {hoveredGroup && (
        <div
          className="absolute right-12 -translate-y-1/2 pointer-events-none transition-all duration-150 ease-out"
          style={{ top: tooltipPos }}
        >
          <div className="flex items-center gap-2.5 px-3.5 py-2 bg-surface-base/95 border border-outline-variant/30 rounded-neo-lg shadow-xl backdrop-blur-md whitespace-nowrap">
            <div className="w-6 h-6 rounded-neo bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-label-md font-bold text-on-surface">
                {hoveredGroup.period || hoveredGroup.period_title || hoveredGroup.period_key}
              </p>
              <p className="text-label-sm text-on-surface-variant">
                {hoveredGroup.items?.length || hoveredGroup.count || 0} items
              </p>
            </div>
            {/* Arrow pointer */}
            <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-surface-base border-r border-t border-outline-variant/30 rotate-45" />
          </div>
        </div>
      )}

      {/* Main Scrubber Rail */}
      <div className="flex flex-col items-center py-2 px-1.5 bg-surface-base/90 border border-outline-variant/20 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] backdrop-blur-sm neo-card gap-1">
        {/* Top Scroll Hint */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          title="Scroll to top"
          className="w-6 h-6 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors text-[10px]"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>

        {/* Chronological Period Pills / Ticks */}
        <div className="flex flex-col items-center gap-1.5 py-1">
          {groups.map((group) => {
            const isActive = activeKey === group.period_key;
            const parts = (group.period || group.period_key).split(" ");
            const shortMonth = parts[0]?.slice(0, 3) || "";
            const shortLabel = parts.length > 1 ? shortMonth : group.period_key.slice(0, 4);

            return (
              <button
                key={group.period_key}
                onClick={() => handleJump(group)}
                onMouseEnter={(e) => handleMouseEnterItem(e, group)}
                title={`${group.period || group.period_key} (${group.items?.length || 0} items)`}
                className={`group relative flex items-center justify-center transition-all duration-200 ${
                  isActive
                    ? "w-8 h-6 rounded-full bg-primary text-on-primary font-bold shadow-md scale-105"
                    : "w-6 h-5 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <span
                  className={`text-[9px] font-mono tracking-tighter transition-opacity ${
                    isActive ? "opacity-100 font-bold" : "opacity-75 group-hover:opacity-100"
                  }`}
                >
                  {shortLabel}
                </span>

                {isActive && (
                  <span className="absolute -left-1 w-1 h-2 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Scroll Hint */}
        <button
          onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
          title="Scroll to bottom"
          className="w-6 h-6 rounded-full flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors text-[10px]"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
