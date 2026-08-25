/**
 * =============================================================================
 * Module: frontend/src/components/ui/FolderCustomizeModal.tsx
 * Purpose: Neomorphic floating modal dialog for customizing an album's icon and color.
 *          Provides 24 curated Lucide icons and 16 stock theme colors with live preview.
 * Used by: Sidebar.tsx, FolderGrid.tsx, App.tsx
 * Dependencies: React, lucide-react, FolderIcon, FOLDER_PALETTE
 * Public Members: FolderCustomizeModal
 * Side Effects: Calls onSave callback with selected icon and color.
 * =============================================================================
 */

import React, { useState } from "react";
import { X, RotateCcw, Check, Sparkles } from "lucide-react";
import { FolderItem } from "../../types";
import { AVAILABLE_FOLDER_ICONS, FolderIcon } from "./FolderIcon";
import { FOLDER_PALETTE } from "./FolderColorPicker";

interface FolderCustomizeModalProps {
  folder: FolderItem;
  isOpen: boolean;
  onClose: () => void;
  onSave: (folderId: number, color: string | null, icon: string) => Promise<void>;
}

export const FolderCustomizeModal: React.FC<FolderCustomizeModalProps> = ({
  folder,
  isOpen,
  onClose,
  onSave,
}) => {
  const [selectedIcon, setSelectedIcon] = useState<string>(folder.icon || "Folder");
  const [selectedColor, setSelectedColor] = useState<string | null>(folder.color || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await onSave(folder.id, selectedColor, selectedIcon);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedIcon("Folder");
    setSelectedColor(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div
        className="max-w-md w-full bg-surface-base border border-outline-variant/20 rounded-neo-xl p-6 neo-card shadow-2xl space-y-6 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
          <div>
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Customize Album</span>
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Personalize icon and color for &ldquo;{folder.name}&rdquo;
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-neo text-on-surface-variant hover:text-on-surface neo-button"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Preview Card */}
        <div className="p-4 rounded-xl neo-pressed bg-surface-container/60 flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center neo-raised transition-all"
            style={{
              backgroundColor: selectedColor ? `${selectedColor}18` : undefined,
            }}
          >
            <FolderIcon
              name={selectedIcon}
              color={selectedColor || "var(--color-primary, #6366f1)"}
              className="w-7 h-7 transition-transform duration-200"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-on-surface-variant font-mono uppercase tracking-wider">
              Preview
            </div>
            <div className="text-sm font-semibold text-on-surface truncate">
              {folder.name}
            </div>
            <div className="text-[11px] text-on-surface-variant mt-0.5">
              Icon: {selectedIcon} • Color: {selectedColor || "Default Theme"}
            </div>
          </div>
        </div>

        {/* Section 1: Choose Icon (6x4 grid = 24 icons) */}
        <div>
          <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
            Select Icon
          </div>
          <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1 rounded-xl neo-pressed bg-surface-container/30">
            {AVAILABLE_FOLDER_ICONS.map((item) => {
              const isSelected = selectedIcon === item.name;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSelectedIcon(item.name)}
                  className={`p-2 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? "neo-pressed bg-primary/20 text-primary ring-2 ring-primary scale-105"
                      : "neo-raised hover:bg-surface-container text-on-surface-variant hover:text-on-surface"
                  }`}
                  title={item.label}
                >
                  <item.Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Choose Color (4x4 grid = 16 stock theme colors) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Select Color
            </span>
            {selectedColor && (
              <button
                type="button"
                onClick={() => setSelectedColor(null)}
                className="text-[11px] text-on-surface-variant hover:text-primary flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Default</span>
              </button>
            )}
          </div>
          <div className="grid grid-cols-8 gap-2.5 p-2 rounded-xl neo-pressed bg-surface-container/30">
            {FOLDER_PALETTE.map((color) => {
              const isSelected = selectedColor?.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-7 h-7 rounded-full transition-transform duration-150 cursor-pointer hover:scale-125 focus:outline-hidden relative ${
                    isSelected
                      ? "ring-2 ring-white ring-offset-2 ring-offset-surface-base scale-110 shadow-lg"
                      : "hover:shadow-sm"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-white absolute inset-0 m-auto" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/15">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-on-surface-variant hover:text-on-surface py-2 px-3 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
          >
            Reset All
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-on-surface-variant hover:text-on-surface rounded-neo neo-button cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold neo-button-primary rounded-neo cursor-pointer transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Apply Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
