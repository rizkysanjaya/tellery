/**
 * =============================================================================
 * Module: frontend/src/components/ui/FloatingDock.tsx
 * Purpose: Apple macOS magnetic floating dock with proximity-based
 *          icon magnification curve, spring damping, and obsidian glass container.
 * Used by: frontend/src/components/SelectionToolbar.tsx, frontend/src/App.tsx
 * Dependencies: React, framer-motion, lucide-react
 * Public Members: FloatingDock, DockItem
 * Side Effects: Renders a fixed floating action bar at the viewport base.
 * =============================================================================
 */

import React, { useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
  MotionValue,
} from "framer-motion";

export interface DockItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  onClick: () => void;
  badge?: number | string;
  variant?: "default" | "primary" | "danger" | "amber";
  active?: boolean;
}

interface FloatingDockProps {
  items: DockItem[];
  className?: string;
}

function DockIcon({
  mouseX,
  item,
}: {
  mouseX: MotionValue<number>;
  item: DockItem;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthSync = useTransform(distance, [-140, 0, 140], [42, 60, 42]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 150, damping: 12 });

  return (
    <motion.div
      ref={ref}
      style={{ width, height: width }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={item.onClick}
      className={`relative flex items-center justify-center rounded-full cursor-pointer transition-all duration-200 border ${
        item.variant === "primary"
          ? "bg-primary hover:bg-primary-hover text-on-primary border-primary/40 shadow-lg"
          : item.variant === "danger"
            ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30"
            : item.active
              ? "bg-primary/15 text-primary border-primary/40"
              : "bg-surface-container-high/70 hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface border-outline-variant/15"
      }`}
    >
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 5, x: "-50%" }}
            className="absolute -top-9 left-1/2 px-2.5 py-1 rounded-md bg-surface-container-lowest/95 backdrop-blur-md border border-outline-variant/20 text-on-surface text-[11px] font-medium whitespace-nowrap shadow-xl pointer-events-none z-50"
          >
            {item.title}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-center pointer-events-none">{item.icon}</div>

      {item.badge !== undefined && (
        <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-primary-container text-on-primary text-[10px] font-mono font-medium rounded-full shadow-md">
          {item.badge}
        </span>
      )}
    </motion.div>
  );
}

export const FloatingDock: React.FC<FloatingDockProps> = ({ items, className = "" }) => {
  const mouseX = useMotionValue(Infinity);

  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-surface-container-low/90 backdrop-blur-xl border border-outline-variant/20 shadow-2xl select-none transition-all duration-200 ${className}`}
    >
      {items.map((item) => (
        <DockIcon key={item.id} mouseX={mouseX} item={item} />
      ))}
    </motion.div>
  );
};
