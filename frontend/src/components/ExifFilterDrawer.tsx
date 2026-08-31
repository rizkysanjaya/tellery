/**
 * =============================================================================
 * Module: frontend/src/components/ExifFilterDrawer.tsx
 * Purpose: Neomorphic Silk Cloud slide-down/popover drawer for smart EXIF metadata filtering
 *          (camera make/model, orientation, resolution, calendar periods).
 * Used by: frontend/src/components/Header.tsx, frontend/src/App.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: ExifFilterDrawer
 * Side Effects: Dispatches filter change and reset events.
 * =============================================================================
 */

import React, { useRef, useEffect } from "react";
import {
  Camera,
  Compass,
  Monitor,
  Calendar,
  X,
  RotateCcw,
  Check,
  Smartphone,
} from "lucide-react";
import {
  ActiveExifFilters,
  FilterMetadataResponse,
} from "../types";

interface ExifFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: FilterMetadataResponse | null;
  activeFilters: ActiveExifFilters;
  onFilterChange: (newFilters: ActiveExifFilters) => void;
  onResetFilters: () => void;
}

export const ExifFilterDrawer: React.FC<ExifFilterDrawerProps> = ({
  isOpen,
  onClose,
  metadata,
  activeFilters,
  onFilterChange,
  onResetFilters,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasActiveFilters = Boolean(
    activeFilters.camera ||
    activeFilters.orientation ||
    activeFilters.min_resolution ||
    activeFilters.year ||
    activeFilters.month
  );

  const cameras = metadata?.cameras || [];
  const periods = metadata?.periods || [];
  const years = metadata?.years || [];
  const orientations = metadata?.orientations;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-background/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        ref={drawerRef}
        className="w-full max-w-2xl bg-surface-base border border-outline-variant/20 rounded-neo-xl shadow-2xl neo-card p-6 space-y-6 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/15 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-neo bg-primary/10 text-primary flex items-center justify-center neo-pressed">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-headline-sm font-bold text-on-surface">Smart EXIF & Date Filters</h3>
              <p className="text-body-sm text-on-surface-variant">
                Filter your archive by camera hardware, orientation, resolution, or date.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={onResetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-neo text-label-md text-error hover:bg-error/10 transition-colors neo-button"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Sections Grid */}
        <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
          {/* 1. Camera / Device */}
          {cameras.length > 0 && (
            <div>
              <label className="flex items-center gap-2 text-label-md font-bold text-on-surface mb-2.5">
                <Smartphone className="w-4 h-4 text-primary" />
                Camera / Device
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onFilterChange({ ...activeFilters, camera: null })}
                  className={`px-3 py-1.5 rounded-neo text-label-md transition-all ${
                    !activeFilters.camera
                      ? "bg-primary text-on-primary font-semibold shadow-xs"
                      : "bg-surface-container text-on-surface-variant hover:text-on-surface neo-button"
                  }`}
                >
                  All Devices
                </button>
                {cameras.map((cam) => {
                  const isSelected = activeFilters.camera === cam.model || activeFilters.camera === cam.label;
                  return (
                    <button
                      key={cam.label}
                      onClick={() =>
                        onFilterChange({
                          ...activeFilters,
                          camera: isSelected ? null : cam.model || cam.label,
                        })
                      }
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-neo text-label-md transition-all ${
                        isSelected
                          ? "bg-primary text-on-primary font-semibold shadow-xs"
                          : "bg-surface-container text-on-surface-variant hover:text-on-surface neo-button"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      <span>{cam.label}</span>
                      <span className="text-[10px] opacity-70">({cam.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. Orientation */}
          <div>
            <label className="flex items-center gap-2 text-label-md font-bold text-on-surface mb-2.5">
              <Compass className="w-4 h-4 text-primary" />
              Orientation
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: null, label: "Any", count: null },
                { id: "landscape", label: "Landscape", count: orientations?.landscape },
                { id: "portrait", label: "Portrait", count: orientations?.portrait },
                { id: "square", label: "Square", count: orientations?.square },
              ].map((opt) => {
                const isSelected = activeFilters.orientation === opt.id;
                return (
                  <button
                    key={opt.label}
                    onClick={() =>
                      onFilterChange({
                        ...activeFilters,
                        orientation: opt.id as any,
                      })
                    }
                    className={`flex flex-col items-center justify-center p-2.5 rounded-neo border text-center transition-all ${
                      isSelected
                        ? "bg-primary/10 border-primary text-primary font-semibold shadow-xs neo-pressed"
                        : "bg-surface-container border-outline-variant/10 text-on-surface-variant hover:text-on-surface neo-button"
                    }`}
                  >
                    <span className="text-label-md">{opt.label}</span>
                    {opt.count !== null && opt.count !== undefined && (
                      <span className="text-[10px] opacity-70 mt-0.5">{opt.count} items</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Resolution */}
          <div>
            <label className="flex items-center gap-2 text-label-md font-bold text-on-surface mb-2.5">
              <Monitor className="w-4 h-4 text-primary" />
              Resolution
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: null, label: "Any Resolution", count: null },
                { id: "4k", label: "4K+ Ultra HD", count: orientations?.uhd_4k },
                { id: "fhd", label: "Full HD (1080p+)", count: orientations?.fhd },
              ].map((opt) => {
                const isSelected = activeFilters.min_resolution === opt.id;
                return (
                  <button
                    key={opt.label}
                    onClick={() =>
                      onFilterChange({
                        ...activeFilters,
                        min_resolution: opt.id as any,
                      })
                    }
                    className={`flex flex-col items-center justify-center p-2.5 rounded-neo border text-center transition-all ${
                      isSelected
                        ? "bg-primary/10 border-primary text-primary font-semibold shadow-xs neo-pressed"
                        : "bg-surface-container border-outline-variant/10 text-on-surface-variant hover:text-on-surface neo-button"
                    }`}
                  >
                    <span className="text-label-md">{opt.label}</span>
                    {opt.count !== null && opt.count !== undefined && (
                      <span className="text-[10px] opacity-70 mt-0.5">{opt.count} items</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Calendar Period / Month */}
          {periods.length > 0 && (
            <div>
              <label className="flex items-center gap-2 text-label-md font-bold text-on-surface mb-2.5">
                <Calendar className="w-4 h-4 text-primary" />
                Calendar Period
              </label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                <button
                  onClick={() => onFilterChange({ ...activeFilters, month: null, year: null })}
                  className={`px-3 py-1.5 rounded-neo text-label-md transition-all ${
                    !activeFilters.month && !activeFilters.year
                      ? "bg-primary text-on-primary font-semibold shadow-xs"
                      : "bg-surface-container text-on-surface-variant hover:text-on-surface neo-button"
                  }`}
                >
                  All Dates
                </button>
                {/* Years */}
                {years.map((y) => {
                  const isSelected = activeFilters.year === y.year && !activeFilters.month;
                  return (
                    <button
                      key={`y-${y.year}`}
                      onClick={() =>
                        onFilterChange({
                          ...activeFilters,
                          year: isSelected ? null : y.year,
                          month: null,
                        })
                      }
                      className={`px-3 py-1.5 rounded-neo text-label-md transition-all ${
                        isSelected
                          ? "bg-primary text-on-primary font-semibold shadow-xs"
                          : "bg-surface-container text-on-surface-variant hover:text-on-surface neo-button"
                      }`}
                    >
                      Year {y.year} <span className="text-[10px] opacity-75">({y.count})</span>
                    </button>
                  );
                })}
                {/* Specific Months */}
                {periods.map((p) => {
                  const isSelected = activeFilters.month === p.period_key;
                  return (
                    <button
                      key={p.period_key}
                      onClick={() =>
                        onFilterChange({
                          ...activeFilters,
                          month: isSelected ? null : p.period_key,
                          year: null,
                        })
                      }
                      className={`px-3 py-1.5 rounded-neo text-label-md transition-all ${
                        isSelected
                          ? "bg-primary text-on-primary font-semibold shadow-xs"
                          : "bg-surface-container text-on-surface-variant hover:text-on-surface neo-button"
                      }`}
                    >
                      {p.label} <span className="text-[10px] opacity-75">({p.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-outline-variant/15">
          <span className="text-body-sm text-on-surface-variant">
            {hasActiveFilters ? "Filters are actively narrowing your view" : "No filters applied"}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-neo bg-primary text-on-primary font-semibold text-label-md hover:bg-primary/90 transition-all shadow-sm"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
