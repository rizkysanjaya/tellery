/**
 * =============================================================================
 * Module: frontend/src/components/ui/AnimatedTabs.tsx
 * Purpose: 21st.dev sliding pill segmented tabs with Framer Motion layoutId spring
 *          physics, supporting smooth fluid transitions between active states.
 * Used by: frontend/src/components/Header.tsx
 * Dependencies: React, framer-motion, lucide-react
 * Public Members: AnimatedTabs, TabItem
 * Side Effects: Dispatches onChange callback when a tab is clicked.
 * =============================================================================
 */

import React from "react";
import { motion } from "framer-motion";

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

interface AnimatedTabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeId: T;
  onChange: (id: T) => void;
  layoutIdPrefix?: string;
  className?: string;
  tabClassName?: string;
}

export function AnimatedTabs<T extends string = string>({
  tabs,
  activeId,
  onChange,
  layoutIdPrefix = "animated-tab",
  className = "",
  tabClassName = "",
}: AnimatedTabsProps<T>) {
  return (
    <div
      className={`inline-flex items-center gap-1 p-1 bg-zinc-950/70 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-inner ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeId === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer select-none ${
              isActive ? "text-white" : "text-zinc-400 hover:text-zinc-200"
            } ${tabClassName}`}
          >
            {/* Sliding Framer Motion Active Pill */}
            {isActive && (
              <motion.div
                layoutId={`${layoutIdPrefix}-pill`}
                className="absolute inset-0 bg-sky-500/20 border border-sky-500/40 rounded-lg shadow-[0_0_15px_rgba(14,165,233,0.3)] z-0"
                transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
              />
            )}

            {/* Tab Icon and Label */}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.icon && <span className={isActive ? "text-sky-400" : "text-zinc-400"}>{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                    isActive
                      ? "bg-sky-500/30 text-sky-200 border border-sky-400/40"
                      : "bg-zinc-800 text-zinc-400 border border-zinc-700/50"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
