/**
 * =============================================================================
 * Module: frontend/src/components/ui/AnimatedTabs.tsx
 * Purpose: Precision segmented control with hairline borders, active pill indicator,
 *          responsive text-to-icon collapsing (hideLabelBelow), and ARIA accessibility.
 * Used by: frontend/src/components/Header.tsx
 * Dependencies: React
 * Public Members: AnimatedTabs, TabItem
 * Side Effects: Dispatches onChange callback when a tab is clicked.
 * =============================================================================
 */

import React from "react";

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
  hideLabelBelow?: "sm" | "md" | "lg" | "xl";
}

export function AnimatedTabs<T extends string = string>({
  tabs,
  activeId,
  onChange,
  className = "",
  tabClassName = "",
  hideLabelBelow,
}: AnimatedTabsProps<T>) {
  const labelHideClass = hideLabelBelow
    ? hideLabelBelow === "sm"
      ? "hidden sm:inline"
      : hideLabelBelow === "md"
      ? "hidden md:inline"
      : hideLabelBelow === "lg"
      ? "hidden lg:inline"
      : "hidden xl:inline"
    : "";

  return (
    <div
      className={`inline-flex items-center gap-0.5 p-0.5 bg-surface-container-lowest/60 border border-outline-variant/15 rounded-lg ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeId === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            title={tab.label}
            aria-label={tab.label}
            className={`relative flex items-center justify-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150 cursor-pointer select-none ${
              isActive
                ? "bg-surface-container text-primary font-semibold border border-outline-variant/20 shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] border border-transparent"
            } ${tabClassName}`}
          >
            {/* Tab Icon and Label */}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.icon && <span className="scale-90">{tab.icon}</span>}
              {tab.label && <span className={labelHideClass}>{tab.label}</span>}
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium ${
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "bg-surface-base text-on-surface-variant"
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
