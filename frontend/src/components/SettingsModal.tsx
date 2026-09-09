/**
 * =============================================================================
 * Module: frontend/src/components/SettingsModal.tsx
 * Purpose: Centralized Silk Cloud neomorphic settings dialog providing local disk cache
 *          metering, cache limit configuration, 1-click cache purge, MTProto vault telemetry,
 *          Battery Saver mode toggle, theme mode switcher, and session disconnect.
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

  const handleClearCache = async () => {
    if (isClearingCache) return;
    setIsClearingCache(true);
    try {
      const result = await clearLocalCache();
      setCacheFeedback(`Reclaimed ${result.freed_formatted}`);
      setTimeout(() => setCacheFeedback(null), 3000);
      await loadCache();
    } catch (err) {
      console.error("Failed to clear local cache:", err);
      setCacheFeedback("Failed to clear cache");
      setTimeout(() => setCacheFeedback(null), 3000);
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleSaveCacheLimit = async (bytes: number) => {
    setIsUpdatingLimit(true);
    try {
      const updated = await updateCacheLimit(bytes);
      setCacheStats(updated);
      setCacheFeedback("Limit updated!");
      setTimeout(() => setCacheFeedback(null), 3000);
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
        className="w-full max-w-xl max-h-[90vh] bg-surface-base rounded-neo-xl neo-card flex flex-col overflow-hidden border border-outline-variant/20 shadow-2xl animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/15 shrink-0 bg-surface-container-lowest/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full neo-pressed bg-surface-base flex items-center justify-center text-primary shadow-inner">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 id="settings-modal-title" className="text-base sm:text-lg font-bold text-on-surface">
                Preferences & Storage
              </h3>
              <p className="text-xs text-on-surface-variant">
                Manage local streaming cache, connection telemetry, and app behavior
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full neo-button flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer touch-manipulation"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Local Cache Management */}
          <div className="p-4 rounded-neo-xl neo-card bg-surface-base space-y-4 border border-outline-variant/15">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg neo-pressed flex items-center justify-center text-primary">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-on-surface">Local Disk Cache</h4>
                  <p className="text-xs text-on-surface-variant">
                    Locally cached video chunks & high-res previews for offline playback
                  </p>
                </div>
              </div>
              <button
                onClick={loadCache}
                disabled={loadingCache}
                className="w-8 h-8 min-w-[32px] min-h-[32px] rounded-full neo-button flex items-center justify-center text-on-surface-variant hover:text-primary transition-all cursor-pointer touch-manipulation"
                title="Refresh cache stats"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCache ? "animate-spin text-primary" : ""}`} />
              </button>
            </div>

            {/* Cache Numbers & Progress Bar */}
            {cacheStats ? (
              <div className="space-y-2.5">
                <div className="flex items-baseline justify-between font-mono">
                  <span className="text-base font-bold text-on-surface tracking-tight">
                    {cacheStats.cache_formatted}
                  </span>
                  <span className="text-xs text-on-surface-variant font-medium">
                    / {cacheStats.max_formatted} ({cacheStats.percent_used}%)
                  </span>
                </div>

                <LiquidProgressBar
                  progress={cacheStats.percent_used}
                  height="h-3"
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
                  <span className="text-xs text-on-surface-variant">
                    {cacheFeedback ? (
                      <span className="text-emerald-400 font-semibold">{cacheFeedback}</span>
                    ) : (
                      "Clearing cache will not delete any files from Telegram cloud."
                    )}
                  </span>
                  <button
                    onClick={handleClearCache}
                    disabled={isClearingCache || cacheStats.cache_bytes === 0}
                    className={`min-h-[36px] px-3.5 py-1.5 rounded-neo-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer touch-manipulation ${
                      isClearingCache
                        ? "neo-pressed bg-surface-base text-emerald-400 cursor-wait"
                        : cacheStats.cache_bytes === 0
                        ? "opacity-50 cursor-not-allowed bg-surface-base text-on-surface-variant"
                        : "neo-button bg-surface-base text-on-surface hover:text-red-400 active:neo-pressed"
                    }`}
                  >
                    <Trash2 className={`w-3.5 h-3.5 ${isClearingCache ? "animate-spin text-emerald-400" : ""}`} />
                    <span>{isClearingCache ? "Purging..." : "Purge Cache"}</span>
                  </button>
                </div>

                {/* Cache Size Limit Controls */}
                <div className="pt-3 border-t border-outline-variant/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                      Cache Size Limit
                    </span>
                  </div>

                  {/* Preset Pills */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "500 MB", bytes: 500 * 1024 * 1024 },
                      { label: "1.5 GB", bytes: 1500 * 1024 * 1024 },
                      { label: "3.0 GB", bytes: 3000 * 1024 * 1024 },
                      { label: "5.0 GB", bytes: 5000 * 1024 * 1024 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => handleSaveCacheLimit(preset.bytes)}
                        disabled={isUpdatingLimit}
                        className={`min-h-[36px] py-1.5 px-2 rounded-neo text-xs font-semibold transition-all cursor-pointer touch-manipulation ${
                          Math.abs(cacheStats.max_bytes - preset.bytes) < 100 * 1024 * 1024
                            ? "neo-pressed bg-surface-base text-primary ring-1 ring-primary/40 font-bold"
                            : "neo-button bg-surface-base text-on-surface hover:text-primary"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
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
                      className="flex-1 min-h-[38px] px-3.5 py-1.5 rounded-neo neo-pressed bg-surface-container-lowest text-on-surface text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary touch-manipulation"
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
                      className="min-h-[38px] px-4 py-1.5 rounded-neo neo-button text-xs font-bold text-primary hover:text-primary/80 disabled:opacity-50 cursor-pointer touch-manipulation"
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
          <div className="p-4 rounded-neo-xl neo-card bg-surface-base space-y-3.5 border border-outline-variant/15">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg neo-pressed flex items-center justify-center text-primary">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-on-surface">Active Telegram Vault</h4>
                  <p className="text-xs text-on-surface-variant">
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
                  className="min-h-[36px] px-3 py-1.5 rounded-neo-lg text-xs font-semibold neo-button text-primary hover:text-primary-hover flex items-center gap-1 cursor-pointer touch-manipulation"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Switch Vault</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-neo bg-surface-container-lowest/50 border border-outline-variant/10">
                <span className="text-on-surface-variant block text-[11px] mb-0.5">Vault Name</span>
                <span className="font-semibold text-on-surface truncate block font-mono">
                  {activeVault?.title || stats?.channel_name || "Default Telegram Vault"}
                </span>
              </div>
              <div className="p-2.5 rounded-neo bg-surface-container-lowest/50 border border-outline-variant/10">
                <span className="text-on-surface-variant block text-[11px] mb-0.5">Access Level</span>
                <span className="font-semibold text-primary flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{activeVault?.role === "owner" ? "Owner (Read / Write)" : "Viewer (Read-Only)"}</span>
                </span>
              </div>
              <div className="p-2.5 rounded-neo bg-surface-container-lowest/50 border border-outline-variant/10">
                <span className="text-on-surface-variant block text-[11px] mb-0.5">Cloud Storage Used</span>
                <span className="font-semibold text-on-surface font-mono">
                  {stats?.total_size_formatted || "0 B"} (Unlimited)
                </span>
              </div>
              <div className="p-2.5 rounded-neo bg-surface-container-lowest/50 border border-outline-variant/10">
                <span className="text-on-surface-variant block text-[11px] mb-0.5">Total Media Archived</span>
                <span className="font-semibold text-on-surface font-mono">
                  {stats ? `${stats.total_files} items (${stats.photo_count} photos, ${stats.video_count} videos)` : "0 items"}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: App Preferences & Performance */}
          <div className="p-4 rounded-neo-xl neo-card bg-surface-base space-y-3 border border-outline-variant/15">
            <h4 className="text-sm font-bold text-on-surface flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              <span>Performance & Display</span>
            </h4>

            <div className="space-y-2.5">
              {/* Battery Saver Toggle */}
              {onToggleBatterySaver && (
                <div className="flex items-center justify-between p-2.5 rounded-neo bg-surface-container-lowest/50 border border-outline-variant/10">
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
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-400 font-bold font-mono">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-on-surface-variant">
                        Pauses looping GIFs & video hover previews to conserve GPU and bandwidth
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onToggleBatterySaver}
                    className={`min-h-[36px] px-3 py-1 rounded-neo-lg text-xs font-bold transition-all cursor-pointer touch-manipulation ${
                      batterySaver
                        ? "neo-pressed bg-amber-500/15 text-amber-400 ring-1 ring-amber-400/40"
                        : "neo-button bg-surface-base text-on-surface-variant hover:text-on-surface"
                    }`}
                  >
                    {batterySaver ? "Enabled" : "Disabled"}
                  </button>
                </div>
              )}

              {/* Theme Switcher */}
              {onToggleTheme && (
                <div className="flex items-center justify-between p-2.5 rounded-neo bg-surface-container-lowest/50 border border-outline-variant/10">
                  <div className="flex items-center gap-2.5">
                    {theme === "dark" ? (
                      <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
                    ) : (
                      <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <div>
                      <span className="text-xs font-semibold text-on-surface block">Visual Theme</span>
                      <p className="text-[11px] text-on-surface-variant">
                        Silk Cloud {theme === "dark" ? "Dark Studio" : "Light Porcelain"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onToggleTheme}
                    className="min-h-[36px] px-3 py-1 rounded-neo-lg text-xs font-bold neo-button text-on-surface-variant hover:text-primary transition-all cursor-pointer touch-manipulation flex items-center gap-1"
                  >
                    {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                    <span>Switch to {theme === "dark" ? "Light" : "Dark"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Session & Security */}
          {stats?.account_name && (
            <div className="p-4 rounded-neo-xl neo-card bg-surface-base flex items-center justify-between border border-outline-variant/15">
              <div className="flex items-center gap-3">
                {stats.user_avatar_url ? (
                  <img
                    src={stats.user_avatar_url}
                    alt={stats.account_name}
                    className="w-9 h-9 rounded-full object-cover ring-1 ring-primary/40 shadow-inner"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/10 neo-pressed flex items-center justify-center text-primary font-bold text-xs shadow-inner">
                    {stats.account_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <span className="text-xs font-bold text-on-surface block">{stats.account_name}</span>
                  <span className="text-[11px] text-on-surface-variant">Active Telegram MTProto Session</span>
                </div>
              </div>

              {onLogout && (
                <button
                  onClick={() => {
                    onClose();
                    onLogout();
                  }}
                  className="min-h-[36px] px-3 py-1.5 rounded-neo-lg text-xs font-semibold neo-button text-error hover:bg-error-container/20 transition-all cursor-pointer touch-manipulation flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-outline-variant/15 flex items-center justify-end shrink-0 bg-surface-container-lowest/30">
          <button
            onClick={onClose}
            className="min-h-[38px] px-5 py-1.5 rounded-neo-lg neo-button text-xs font-bold text-on-surface hover:text-primary cursor-pointer touch-manipulation"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
