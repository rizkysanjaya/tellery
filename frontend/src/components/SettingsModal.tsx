/**
 * =============================================================================
 * Module: frontend/src/components/SettingsModal.tsx
 * Purpose: Precision pro-grade settings dialog providing local disk cache metering,
 *          cache limit configuration, 1-click cache purge, MTProto vault telemetry,
 *          Battery Saver mode toggle, theme switcher, and session disconnect.
 *          Supports WCAG 2.2 AA visible focus rings and keyboard Escape key modal dismissal.
 * Used by: frontend/src/App.tsx, frontend/src/components/Sidebar.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts, frontend/src/api.ts,
 *               frontend/src/components/ui/LiquidProgressBar.tsx
 * Public Members: SettingsModal, SettingsModalProps
 * Side Effects: Fetches cache statistics over HTTP, dispatches cache clearing & limit updates,
 *                toggles theme and battery saver preferences in localStorage.
 * =============================================================================
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  Settings,
  HardDrive,
  Trash2,
  Cloud,
  ShieldCheck,
  Zap,
  ZapOff,
  Sun,
  Moon,
  LogOut,
  RefreshCw,
  Loader2,
  Sliders,
} from "lucide-react";
import { CacheStats, StatsResponse, VaultItem } from "../types";
import { clearLocalCache, fetchCacheStats, updateCacheLimit } from "../api";
import { LiquidProgressBar } from "./ui/LiquidProgressBar";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: StatsResponse | null;
  activeVault?: VaultItem | null;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  batterySaver?: boolean;
  onToggleBatterySaver?: () => void;
  onLogout?: () => void;
  onOpenVaultSwitcher?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  stats,
  activeVault,
  theme = "dark",
  onToggleTheme,
  batterySaver = false,
  onToggleBatterySaver,
  onLogout,
  onOpenVaultSwitcher,
}) => {
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [loadingCache, setLoadingCache] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheFeedback, setCacheFeedback] = useState<string | null>(null);
  const [customLimitGb, setCustomLimitGb] = useState<string>("2.0");
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);

  // Load cache stats whenever modal opens
  const loadCache = useCallback(async () => {
    setLoadingCache(true);
    try {
      const data = await fetchCacheStats();
      setCacheStats(data);
      const currentGb = (data.max_bytes / (1024 * 1024 * 1024)).toFixed(1).replace(/\.0$/, "");
      setCustomLimitGb(currentGb);
    } catch (err) {
      console.error("Failed to load cache stats:", err);
    } finally {
      setLoadingCache(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadCache();
    }
  }, [isOpen, loadCache]);

  // Keyboard Escape listener for accessible modal dismissal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleClearCache = async () => {
    setIsClearingCache(true);
    setCacheFeedback(null);
    try {
      const result = await clearLocalCache();
      setCacheFeedback(`Cleared ${result.freed_formatted || "cache"}!`);
      await loadCache();
    } catch (err) {
      console.error("Failed to clear cache:", err);
      setCacheFeedback("Failed to clear cache.");
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleSaveCacheLimit = async (limitBytes: number) => {
    setIsUpdatingLimit(true);
    try {
      await updateCacheLimit(limitBytes);
      await loadCache();
    } catch (err) {
      console.error("Failed to update cache limit:", err);
    } finally {
      setIsUpdatingLimit(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] bg-surface-container-low/95 backdrop-blur-md rounded-2xl flex flex-col overflow-hidden border border-outline-variant/20 shadow-2xl animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-outline-variant/15 shrink-0 bg-surface-container-lowest/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 id="settings-modal-title" className="text-sm sm:text-base font-bold text-on-surface">
                Preferences & Storage
              </h3>
              <p className="text-[11px] text-on-surface-variant/70">
                Manage local streaming cache, connection telemetry, and app behavior
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 min-w-[32px] min-h-[32px] rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Section 1: Local Cache Management */}
          <div className="p-4 rounded-xl bg-surface-container-lowest/40 space-y-3.5 border border-outline-variant/15">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                  <HardDrive className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-on-surface">Local Disk Cache</h4>
                  <p className="text-[11px] text-on-surface-variant/70">
                    Locally cached video chunks & high-res previews for smooth playback
                  </p>
                </div>
              </div>
              <button
                onClick={loadCache}
                disabled={loadingCache}
                className="w-7 h-7 rounded-md text-on-surface-variant hover:text-primary hover:bg-white/[0.04] flex items-center justify-center transition-colors cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
                title="Refresh cache stats"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCache ? "animate-spin text-primary" : ""}`} />
              </button>
            </div>

            {/* Cache Numbers & Progress Bar */}
            {cacheStats ? (
              <div className="space-y-2.5">
                <div className="flex items-baseline justify-between font-mono">
                  <span className="text-sm font-bold text-on-surface tracking-tight">
                    {cacheStats.cache_formatted}
                  </span>
                  <span className="text-xs text-on-surface-variant font-medium">
                    / {cacheStats.max_formatted} ({cacheStats.percent_used}%)
                  </span>
                </div>

                <LiquidProgressBar
                  progress={cacheStats.percent_used}
                  height="h-2.5"
                  color={
                    cacheStats.percent_used > 85
                      ? "error"
                      : cacheStats.percent_used > 60
                      ? "amber"
                      : "indigo"
                  }
                  isPulsing={isClearingCache}
                />

                {/* Clear Cache Action */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-on-surface-variant/70">
                    {cacheFeedback ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{cacheFeedback}</span>
                    ) : (
                      "Clearing cache will not delete any files from Telegram cloud."
                    )}
                  </span>
                  <button
                    onClick={handleClearCache}
                    disabled={isClearingCache || cacheStats.cache_bytes === 0}
                    className={`min-h-[32px] px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none ${
                      isClearingCache
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 cursor-wait"
                        : cacheStats.cache_bytes === 0
                        ? "opacity-50 cursor-not-allowed bg-surface-container text-on-surface-variant/50"
                        : "border border-rose-500/25 text-rose-400 bg-rose-500/10 hover:bg-rose-500/20"
                    }`}
                  >
                    <Trash2 className={`w-3.5 h-3.5 ${isClearingCache ? "animate-spin text-emerald-600 dark:text-emerald-400" : ""}`} />
                    <span>{isClearingCache ? "Purging..." : "Purge Cache"}</span>
                  </button>
                </div>

                {/* Cache Size Limit Controls */}
                <div className="pt-3 border-t border-outline-variant/10 space-y-2">
                  <span className="text-[10px] font-semibold text-on-surface-variant/70 uppercase tracking-wider">
                    Cache Size Limit
                  </span>

                  {/* Preset Pills */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "500 MB", bytes: 500 * 1024 * 1024 },
                      { label: "1.5 GB", bytes: 1500 * 1024 * 1024 },
                      { label: "3.0 GB", bytes: 3000 * 1024 * 1024 },
                      { label: "5.0 GB", bytes: 5000 * 1024 * 1024 },
                    ].map((preset) => {
                      const isMatch = Math.abs(cacheStats.max_bytes - preset.bytes) < 100 * 1024 * 1024;
                      return (
                        <button
                          key={preset.label}
                          onClick={() => handleSaveCacheLimit(preset.bytes)}
                          disabled={isUpdatingLimit}
                          className={`min-h-[32px] py-1 px-2 rounded-md text-xs font-medium transition-colors cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none border ${
                            isMatch
                              ? "bg-primary text-on-primary border-primary font-semibold shadow-xs"
                              : "bg-surface-container-lowest/60 border-outline-variant/15 text-on-surface-variant hover:text-on-surface hover:bg-white/[0.04]"
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom Limit Input */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      min="0.2"
                      max="100"
                      step="0.5"
                      value={customLimitGb}
                      onChange={(e) => setCustomLimitGb(e.target.value)}
                      placeholder="2.0"
                      className="flex-1 min-h-[34px] px-3 py-1 rounded-md bg-surface-container-lowest border border-outline-variant/20 text-on-surface text-xs font-mono outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 touch-manipulation"
                    />
                    <span className="text-xs font-mono text-on-surface-variant">GB</span>
                    <button
                      onClick={() => {
                        const gb = parseFloat(customLimitGb);
                        if (!isNaN(gb) && gb >= 0.1) {
                          handleSaveCacheLimit(Math.round(gb * 1024 * 1024 * 1024));
                        }
                      }}
                      disabled={isUpdatingLimit || !customLimitGb}
                      className="min-h-[34px] px-3 py-1 rounded-md bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-xs font-semibold text-primary hover:text-primary/90 disabled:opacity-50 cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors"
                    >
                      {isUpdatingLimit ? "Saving..." : "Set Limit"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 flex items-center justify-center gap-2 text-xs text-on-surface-variant">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Reading cache status...</span>
              </div>
            )}
          </div>

          {/* Section 2: Active Telegram Vault Telemetry */}
          <div className="p-4 rounded-xl bg-surface-container-lowest/40 space-y-3 border border-outline-variant/15">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary">
                  <Cloud className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-on-surface">Active Telegram Vault</h4>
                  <p className="text-[11px] text-on-surface-variant/70">
                    Current cloud storage target & MTProto connection
                  </p>
                </div>
              </div>
              {onOpenVaultSwitcher && (
                <button
                  onClick={() => {
                    onClose();
                    onOpenVaultSwitcher();
                  }}
                  className="min-h-[30px] px-2.5 py-1 rounded-md text-xs font-medium text-primary hover:bg-primary/10 border border-primary/20 flex items-center gap-1 cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Switch Vault</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-surface-container-lowest/60 border border-outline-variant/10">
                <span className="text-on-surface-variant/70 block text-[10px] mb-0.5">Vault Name</span>
                <span className="font-semibold text-on-surface truncate block font-mono">
                  {activeVault?.title || stats?.channel_name || "Default Telegram Vault"}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-container-lowest/60 border border-outline-variant/10">
                <span className="text-on-surface-variant/70 block text-[10px] mb-0.5">Access Level</span>
                <span className="font-semibold text-primary flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{activeVault?.role === "owner" ? "Owner (Read / Write)" : "Viewer (Read-Only)"}</span>
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-container-lowest/60 border border-outline-variant/10">
                <span className="text-on-surface-variant/70 block text-[10px] mb-0.5">Cloud Storage Used</span>
                <span className="font-semibold text-on-surface font-mono">
                  {stats?.total_size_formatted || "0 B"} (Unlimited)
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-surface-container-lowest/60 border border-outline-variant/10">
                <span className="text-on-surface-variant/70 block text-[10px] mb-0.5">Total Media Archived</span>
                <span className="font-semibold text-on-surface font-mono">
                  {stats ? `${stats.total_files} items (${stats.photo_count} photos, ${stats.video_count} videos)` : "0 items"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: App Preferences & Performance */}
          <div className="p-4 rounded-xl bg-surface-container-lowest/40 space-y-3 border border-outline-variant/15">
            <h4 className="text-xs font-semibold text-on-surface flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-primary" />
              <span>Performance & Display</span>
            </h4>

            <div className="space-y-2">
              {/* Battery Saver Toggle */}
              {onToggleBatterySaver && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-lowest/60 border border-outline-variant/10">
                  <div className="flex items-center gap-2.5">
                    {batterySaver ? (
                      <ZapOff className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Zap className="w-4 h-4 text-primary shrink-0" />
                    )}
                    <div>
                      <div className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                        <span>Battery Saver / Low Power</span>
                        {batterySaver && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 font-bold font-mono">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-on-surface-variant/70">
                        Pauses looping GIFs & video hover previews to conserve GPU and bandwidth
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onToggleBatterySaver}
                    className={`min-h-[30px] px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-amber-400 focus-visible:outline-none border ${
                      batterySaver
                        ? "bg-amber-500/15 text-amber-400 border-amber-400/30"
                        : "bg-surface-container text-on-surface-variant hover:text-on-surface border-outline-variant/15"
                    }`}
                  >
                    {batterySaver ? "Enabled" : "Disabled"}
                  </button>
                </div>
              )}

              {/* Theme Switcher */}
              {onToggleTheme && (
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface-container-lowest/60 border border-outline-variant/10">
                  <div className="flex items-center gap-2.5">
                    {theme === "dark" ? (
                      <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
                    ) : (
                      <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <div>
                      <span className="text-xs font-semibold text-on-surface block">Visual Theme</span>
                      <p className="text-[11px] text-on-surface-variant/70">
                        {theme === "dark" ? "Dark Mode (OLED Pure Black)" : "Light Mode"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onToggleTheme}
                    className="min-h-[30px] px-2.5 py-1 rounded-md text-xs font-medium bg-surface-container hover:bg-surface-container-high border border-outline-variant/15 text-on-surface hover:text-primary transition-colors cursor-pointer touch-manipulation flex items-center gap-1 focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    {theme === "dark" ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                    <span>Switch to {theme === "dark" ? "Light" : "Dark"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Session & Security */}
          {stats?.account_name && (
            <div className="p-3.5 rounded-xl bg-surface-container-lowest/40 flex items-center justify-between border border-outline-variant/15">
              <div className="flex items-center gap-2.5">
                {stats.user_avatar_url ? (
                  <img
                    src={stats.user_avatar_url}
                    alt={stats.account_name}
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-primary/40"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                    {stats.account_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <span className="text-xs font-semibold text-on-surface block">{stats.account_name}</span>
                  <span className="text-[11px] text-on-surface-variant/70">Active Telegram MTProto Session</span>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="min-h-[30px] px-2.5 py-1 rounded-md text-xs font-medium text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer touch-manipulation flex items-center gap-1.5 focus-visible:ring-1 focus-visible:ring-rose-400 focus-visible:outline-none"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Log Out</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-outline-variant/15 flex items-center justify-end shrink-0 bg-surface-container-lowest/40">
          <button
            onClick={onClose}
            className="min-h-[32px] px-4 py-1 rounded-md bg-surface-container hover:bg-surface-container-high border border-outline-variant/20 text-xs font-medium text-on-surface hover:text-primary cursor-pointer touch-manipulation focus-visible:ring-1 focus-visible:ring-primary focus-visible:outline-none transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
