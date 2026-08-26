/**
 * =============================================================================
 * Module: frontend/src/components/ui/FolderCoverModal.tsx
 * Purpose: Neomorphic floating modal dialog allowing users to choose an image/video
 *          from inside an album to act as its custom cover thumbnail.
 * Used by: Sidebar.tsx, FolderGrid.tsx, App.tsx
 * Dependencies: React, lucide-react, frontend/src/api.ts, frontend/src/types.ts
 * Public Members: FolderCoverModal
 * Side Effects: Fetches folder media items via HTTP, dispatches onSaveCover callback.
 * =============================================================================
 */

import React, { useEffect, useState } from "react";
import { X, Image as ImageIcon, Check, Loader2, RotateCcw } from "lucide-react";
import { FolderItem, FolderMediaItem } from "../../types";
import { fetchFolderMediaOptions } from "../../api";

interface FolderCoverModalProps {
  folder: FolderItem;
  isOpen: boolean;
  onClose: () => void;
  onSaveCover: (folderId: number, mediaId: number | null) => Promise<void>;
}

export const FolderCoverModal: React.FC<FolderCoverModalProps> = ({
  folder,
  isOpen,
  onClose,
  onSaveCover,
}) => {
  const [items, setItems] = useState<FolderMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<number | null>(
    folder.cover_media_id ?? null
  );
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedMediaId(folder.cover_media_id ?? null);
    setLoading(true);
    fetchFolderMediaOptions(folder.id)
      .then((res) => {
        setItems(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [isOpen, folder.id, folder.cover_media_id]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveCover(folder.id, selectedMediaId);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToLatest = async () => {
    setSelectedMediaId(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div
        className="max-w-xl w-full bg-surface-base border border-outline-variant/20 rounded-neo-xl p-6 neo-card shadow-2xl space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/15">
          <div>
            <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              <span>Choose Cover Thumbnail</span>
            </h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Select any photo or video inside &ldquo;{folder.name}&rdquo; as its album cover
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-neo text-on-surface-variant hover:text-on-surface neo-button cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Media Grid / Empty State / Loading */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-on-surface-variant">
            <span>Album contents ({items.length} items)</span>
            {selectedMediaId !== null && (
              <button
                type="button"
                onClick={handleResetToLatest}
                className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to latest added</span>
              </button>
            )}
          </div>

          {loading ? (
            <div className="h-48 flex items-center justify-center neo-pressed rounded-xl bg-surface-container/40">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-4 neo-pressed rounded-xl bg-surface-container/40">
              <ImageIcon className="w-8 h-8 text-on-surface-variant/40 mb-2" />
              <p className="text-xs text-on-surface-variant">
                This album doesn't contain any media items yet.
              </p>
              <p className="text-[11px] text-on-surface-variant/70 mt-0.5">
                Add photos or videos to this album first before selecting a cover.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5 max-h-72 overflow-y-auto p-2 neo-pressed rounded-xl bg-surface-container/30">
              {items.map((media) => {
                const isSelected = selectedMediaId === media.id;
                return (
                  <button
                    key={media.id}
                    type="button"
                    onClick={() => setSelectedMediaId(media.id)}
                    className={`group relative aspect-square rounded-lg overflow-hidden transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? "ring-3 ring-primary scale-[0.96] shadow-md"
                        : "hover:opacity-90 hover:scale-102"
                    }`}
                  >
                    {media.thumbnail_url ? (
                      <img
                        src={media.thumbnail_url}
                        alt={media.file_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface-container flex items-center justify-center text-on-surface-variant text-xs">
                        {media.file_name.slice(-3)}
                      </div>
                    )}

                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/30 flex items-center justify-center backdrop-blur-xs">
                        <div className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-lg">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/15">
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
            disabled={isSaving || (items.length === 0 && selectedMediaId === null)}
            className="px-4 py-2 text-xs font-semibold neo-button-primary rounded-neo cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Save as Album Cover</span>
          </button>
        </div>
      </div>
    </div>
  );
};
