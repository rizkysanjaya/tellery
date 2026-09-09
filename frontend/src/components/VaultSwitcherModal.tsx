/**
 * =============================================================================
 * Module: frontend/src/components/VaultSwitcherModal.tsx
 * Purpose: Pro-grade flat obsidian modal dialog allowing users to switch between
 *          multiple owned Telegram storage vaults with instantaneous state synchronization,
 *          search filtering, MTProto dialog refresh, and shortcut to Vault Strategy Hub.
 * Used by: frontend/src/App.tsx, frontend/src/components/Sidebar.tsx
 * Dependencies: React, lucide-react, frontend/src/types.ts
 * Public Members: VaultSwitcherModal
 * Side Effects: Executes HTTP requests to refresh dialogs and switch active vault in backend.
 * =============================================================================
 */

import React, { useState, useMemo } from "react";
import {
  X,
  Search,
  Cloud,
  ShieldCheck,
  Eye,
  Check,
  RefreshCw,
  HardDrive,
  Database,
  Radio,
  Sparkles,
} from "lucide-react";
import { VaultItem } from "../types";

interface VaultSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaults: VaultItem[];
  activeVault: VaultItem | null;
  onSelectVault: (vaultId: number) => Promise<void>;
  onRefreshVaults: () => Promise<void>;
  onOpenVaultSetup?: () => void;
  isRefreshing?: boolean;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export const VaultSwitcherModal: React.FC<VaultSwitcherModalProps> = ({
  isOpen,
  onClose,
  vaults,
  activeVault,
  onSelectVault,
  onRefreshVaults,
  onOpenVaultSetup,
  isRefreshing = false,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [switchingId, setSwitchingId] = useState<number | null>(null);

  // Filter vaults by search term
  const filteredVaults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return vaults;
    return vaults.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        (v.username && v.username.toLowerCase().includes(q)) ||
        v.id.toString().includes(q)
    );
  }, [vaults, searchQuery]);

  // Split into Owned (Write capable) vs Joined (Read-Only)
  const ownedVaults = useMemo(
    () => filteredVaults.filter((v) => v.role === "owner"),
    [filteredVaults]
  );
  const joinedVaults = useMemo(
    () => filteredVaults.filter((v) => v.role === "viewer"),
    [filteredVaults]
  );

  if (!isOpen) return null;

  const handleSelect = async (vault: VaultItem) => {
    if (activeVault && activeVault.id === vault.id) {
      onClose();
      return;
    }
    setSwitchingId(vault.id);
    try {
      await onSelectVault(vault.id);
      onClose();
    } catch (err) {
      console.error("Failed to switch vault:", err);
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container-low/95 backdrop-blur-md border border-outline-variant/20 rounded-2xl max-w-xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/15 shrink-0 bg-surface-container-lowest/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Cloud className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 id="vault-modal-title" className="text-sm sm:text-base font-bold text-on-surface tracking-tight">
                Switch Storage Vault
              </h2>
              <p className="text-[11px] text-on-surface-variant/70">
                Select a Telegram channel or supergroup to browse
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Vault Setup & Strategy (Step 5) */}
            {onOpenVaultSetup && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenVaultSetup();
                }}
                className="px-2.5 py-1 rounded-md text-xs font-medium text-primary hover:bg-primary/10 border border-primary/20 flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Open Welcome & Vault Strategy Hub (Step 5)"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Vault Strategy Hub</span>
              </button>
            )}

            {/* Refresh Dialogs button */}
            <button
              onClick={() => onRefreshVaults()}
              disabled={isRefreshing}
              className={`p-1.5 rounded-md text-on-surface-variant hover:text-primary hover:bg-white/[0.04] transition-colors cursor-pointer border border-transparent hover:border-outline-variant/15 ${
                isRefreshing ? "text-primary cursor-wait" : ""
              }`}
              title="Re-scan Telegram dialogs for newly created or joined channels"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search Filter Bar */}
        <div className="px-5 py-3 border-b border-outline-variant/10 shrink-0">
          <div className="bg-surface-container-lowest/70 border border-outline-variant/15 rounded-lg px-3 py-1.5 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-on-surface-variant/70 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vaults by name, username, or ID..."
              className="w-full bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-on-surface-variant hover:text-on-surface text-xs cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Vault List Container */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Section 1: Owned Storage Vaults */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                My Storage Vaults ({ownedVaults.length})
              </span>
              <span className="text-[10px] text-on-surface-variant/70">Full Read & Write Access</span>
            </div>

            {ownedVaults.length === 0 ? (
              <div className="p-3.5 rounded-lg bg-surface-container-lowest/50 border border-outline-variant/10 text-center text-xs text-on-surface-variant/70">
                No owned vaults match your search filter.
              </div>
            ) : (
              <div className="space-y-1.5">
                {ownedVaults.map((vault) => {
                  const isActive = activeVault?.id === vault.id;
                  const isSwitching = switchingId === vault.id;

                  return (
                    <div
                      key={vault.id}
                      onClick={() => handleSelect(vault)}
                      className={`w-full p-2.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer select-none group border ${
                        isActive
                          ? "bg-primary/10 border-primary/25 shadow-xs"
                          : "bg-surface-container-lowest/50 border-outline-variant/10 hover:bg-white/[0.04] hover:border-outline-variant/20"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Channel Icon */}
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                            isActive
                              ? "bg-primary text-on-primary border-primary"
                              : "bg-surface-container text-primary border-outline-variant/15"
                          }`}
                        >
                          <Database className="w-4 h-4" />
                        </div>

                        {/* Details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                              {vault.title}
                            </span>
                            {isActive && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant/70 mt-0.5">
                            {vault.username && (
                              <span className="text-primary/80">@{vault.username}</span>
                            )}
                            {vault.username && <span>•</span>}
                            <span>{vault.media_count.toLocaleString()} items</span>
                            <span>•</span>
                            <span>{formatBytes(vault.total_size_bytes)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Badge / Status */}
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <ShieldCheck className="w-3 h-3" />
                          Owner
                        </span>

                        {isSwitching ? (
                          <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />
                        ) : isActive ? (
                          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 text-on-surface-variant flex items-center justify-center transition-opacity">
                            <Radio className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Joined Channels (Read-Only) - Only rendered if any exist */}
          {joinedVaults.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-on-surface-variant" />
                  Connected Channels ({joinedVaults.length})
                </span>
                <span className="text-[10px] text-on-surface-variant/70">View-Only Access</span>
              </div>

              <div className="space-y-1.5">
                {joinedVaults.map((vault) => {
                  const isActive = activeVault?.id === vault.id;
                  const isSwitching = switchingId === vault.id;

                  return (
                    <div
                      key={vault.id}
                      onClick={() => handleSelect(vault)}
                      className={`w-full p-2.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer select-none group border ${
                        isActive
                          ? "bg-amber-500/10 border-amber-500/25 shadow-xs"
                          : "bg-surface-container-lowest/50 border-outline-variant/10 hover:bg-white/[0.04] hover:border-outline-variant/20"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Channel Icon */}
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                            isActive
                              ? "bg-surface-container-high text-primary border-primary/40"
                              : "bg-surface-container text-on-surface-variant/70 border-outline-variant/15"
                          }`}
                        >
                          <HardDrive className="w-4 h-4" />
                        </div>

                        {/* Details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-on-surface truncate group-hover:text-primary transition-colors">
                              {vault.title}
                            </span>
                            {isActive && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant/70 mt-0.5">
                            {vault.username && (
                              <span className="text-on-surface-variant/80">@{vault.username}</span>
                            )}
                            {vault.username && <span>•</span>}
                            <span>{vault.media_count.toLocaleString()} indexed</span>
                            <span>•</span>
                            <span>{formatBytes(vault.total_size_bytes)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Badge / Status */}
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-container text-on-surface-variant border border-outline-variant/20">
                          <Eye className="w-3 h-3" />
                          Read-Only
                        </span>

                        {isSwitching ? (
                          <RefreshCw className="w-3.5 h-3.5 text-primary animate-spin" />
                        ) : isActive ? (
                          <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 text-on-surface-variant flex items-center justify-center transition-opacity">
                            <Radio className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-2.5 bg-surface-container-lowest/60 border-t border-outline-variant/10 flex items-center justify-between text-[11px] text-on-surface-variant/70 shrink-0">
          <span>Total Vaults: {vaults.length} accessible</span>
          <span className="hidden sm:inline">Partitioned timeline queries are sub-millisecond indexed.</span>
        </div>
      </div>
    </div>
  );
};

