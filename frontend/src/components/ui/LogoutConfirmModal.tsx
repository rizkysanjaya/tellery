/**
 * =============================================================================
 * Module: frontend/src/components/ui/LogoutConfirmModal.tsx
 * Purpose: Precision confirmation dialog before disconnecting/logging out of the active Telegram MTProto session.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, lucide-react
 * Public Members: LogoutConfirmModal
 * Side Effects: Disconnects session via onConfirm callback when confirmed by user.
 * =============================================================================
 */

import React, { useEffect } from "react";
import { LogOut, X, CloudOff, RefreshCw } from "lucide-react";

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoggingOut?: boolean;
  accountName?: string;
  vaultTitle?: string;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  isLoggingOut = false,
  accountName,
  vaultTitle,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoggingOut) {
        onCancel();
      } else if (e.key === "Enter" && !isLoggingOut) {
        onConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoggingOut, onCancel, onConfirm]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={() => {
        if (!isLoggingOut) onCancel();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container-low/95 backdrop-blur-md border border-outline-variant/20 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-150 relative select-none"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoggingOut}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-50"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-center gap-3.5 mb-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center shrink-0">
            <LogOut className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-on-surface">
              Disconnect Session?
            </h3>
            <p className="text-[11px] text-on-surface-variant">
              Log out of your Telegram storage session
            </p>
          </div>
        </div>

        {/* Info card */}
        <div className="my-4 p-3.5 rounded-xl bg-surface-container-lowest/80 border border-outline-variant/15 text-xs text-on-surface-variant leading-relaxed space-y-2.5">
          <p>
            Are you sure you want to disconnect? You will need to log in again with your phone number to access Tellery.
          </p>

          {(accountName || vaultTitle) && (
            <div className="pt-2 border-t border-outline-variant/15 flex flex-col gap-1.5 text-[11px]">
              {accountName && (
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Active Account:</span>
                  <span className="font-semibold text-on-surface truncate max-w-[170px]">{accountName}</span>
                </div>
              )}
              {vaultTitle && (
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Current Vault:</span>
                  <span className="font-semibold text-primary truncate max-w-[170px]">{vaultTitle}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400/90 pt-1">
            <CloudOff className="w-3.5 h-3.5 shrink-0" />
            <span>All media files remain safe on Telegram cloud.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoggingOut}
            className="flex-1 py-2 px-3 rounded-lg text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04] transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoggingOut}
            className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isLoggingOut ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Disconnecting...</span>
              </>
            ) : (
              <>
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
