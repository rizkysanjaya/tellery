/**
 * =============================================================================
 * Module: frontend/src/components/OnboardingWizard.tsx
 * Purpose: Fullscreen Silk Cloud neomorphic stepped onboarding wizard for zero-config Telegram login,
 *          OTP verification, 2FA cloud password management, and 1-click private vault channel provisioning.
 * Used by: frontend/src/App.tsx
 * Dependencies: React, framer-motion, lucide-react, frontend/src/types.ts, frontend/src/api.ts
 * Public Members: OnboardingWizard
 * Side Effects: Submits authentication requests, sends MTProto OTP codes, and creates storage channels in Telegram.
 * =============================================================================
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cloud,
  Key,
  Phone,
  MessageSquare,
  Lock,
  FolderPlus,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { AuthStatusResponse, AuthStep, VaultItem } from "../types";
import {
  fetchAuthStatus,
  submitCredentials,
  sendAuthCode,
  verifyAuthCode,
  verifyAuthPassword,
  createStorageVault,
  fetchVaults,
  setActiveVault,
} from "../api";

interface OnboardingWizardProps {
  initialStatus: AuthStatusResponse;
  onComplete: (status: AuthStatusResponse) => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  initialStatus,
  onComplete,
}) => {
  const [step, setStep] = useState<AuthStep>(initialStatus.step);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Credentials
  const [apiId, setApiId] = useState<string>("");
  const [apiHash, setApiHash] = useState<string>("");
  const [useDefaultCredentials, setUseDefaultCredentials] = useState(true);

  // Step 2: Phone
  const [phoneNumber, setPhoneNumber] = useState<string>(initialStatus.phone || "");

  // Step 3: OTP Code
  const [phoneCode, setPhoneCode] = useState<string>("");
  const [phoneCodeHash, setPhoneCodeHash] = useState<string>(initialStatus.phone_code_hash || "");
  const [resendCountdown, setResendCountdown] = useState<number>(60);

  // Step 4: 2FA Password
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Step 5: Vault Setup
  const [vaultTitle, setVaultTitle] = useState<string>("TeleGallery Cloud Vault");
  const [availableVaults, setAvailableVaults] = useState<VaultItem[]>([]);
  const [createdChannelInfo, setCreatedChannelInfo] = useState<{ id: number; title: string } | null>(null);

  // User Profile info
  const [userProfile, setUserProfile] = useState(initialStatus.user || null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === "need_code" && resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [step, resendCountdown]);

  // Load existing vaults if step reaches need_vault
  useEffect(() => {
    if (step === "need_vault") {
      fetchVaults()
        .then((vaults) => {
          const writeable = vaults.filter((v) => v.can_upload);
          setAvailableVaults(writeable);
        })
        .catch(() => {});
    }
  }, [step]);

  // 1. Handle Submit Credentials
  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const targetId = useDefaultCredentials ? 2040 : parseInt(apiId.trim(), 10);
    const targetHash = useDefaultCredentials ? "b1844dda5045e8e4585d827ddf3f6de3" : apiHash.trim();

    if (!targetId || !targetHash) {
      setError("Please provide a valid Telegram API ID and API Hash.");
      setLoading(false);
      return;
    }

    try {
      await submitCredentials(targetId, targetHash);
      setStep("need_phone");
    } catch (err: any) {
      setError(err.message || "Failed to save API credentials.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle Send Phone Code
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phoneNumber.trim()) {
      setError("Please enter your Telegram phone number with country code.");
      return;
    }

    setLoading(true);
    try {
      const res = await sendAuthCode(phoneNumber.trim());
      setPhoneCodeHash(res.phone_code_hash);
      setResendCountdown(res.timeout || 60);
      setStep("need_code");
    } catch (err: any) {
      setError(err.message || "Failed to send verification code.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Verify Code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!phoneCode.trim()) {
      setError("Please enter the verification code received from Telegram.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyAuthCode(phoneCode.trim(), phoneCodeHash);
      if (res.step === "need_password") {
        setStep("need_password");
      } else {
        if (res.user) setUserProfile(res.user);
        setStep(res.step as AuthStep);
      }
    } catch (err: any) {
      setError(err.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  };

  // 4. Handle Verify 2FA Password
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!password) {
      setError("Please enter your Two-Step Verification cloud password.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyAuthPassword(password);
      if (res.user) setUserProfile(res.user);
      setStep(res.step as AuthStep);
    } catch (err: any) {
      setError(err.message || "Incorrect 2FA password.");
    } finally {
      setLoading(false);
    }
  };

  // 5. Handle Create New Vault
  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!vaultTitle.trim()) {
      setError("Please enter a title for your private storage vault.");
      return;
    }

    setLoading(true);
    try {
      const res = await createStorageVault(vaultTitle.trim());
      setCreatedChannelInfo({ id: res.channel_id, title: res.title });
      setStep("ready");
    } catch (err: any) {
      setError(err.message || "Failed to create storage vault.");
    } finally {
      setLoading(false);
    }
  };

  // 5b. Handle Select Existing Vault
  const handleSelectExistingVault = async (vault: VaultItem) => {
    setError(null);
    setLoading(true);
    try {
      await setActiveVault(vault.id);
      setCreatedChannelInfo({ id: vault.id, title: vault.title });
      setStep("ready");
    } catch (err: any) {
      setError(err.message || "Failed to activate selected vault.");
    } finally {
      setLoading(false);
    }
  };

  // 6. Handle Launch Gallery
  const handleFinishOnboarding = async () => {
    setLoading(true);
    try {
      const finalStatus = await fetchAuthStatus();
      onComplete(finalStatus);
    } catch {
      onComplete({
        is_authenticated: true,
        step: "ready",
        has_credentials: true,
        user: userProfile,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4 py-8 overflow-y-auto">
      {/* Background Ambience */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[140px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative w-full max-w-lg neo-card rounded-neo-xl p-8 bg-surface-base text-on-surface shadow-2xl z-10"
      >
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-full neo-pressed flex items-center justify-center text-primary mb-4 shadow-inner">
            <Cloud className="w-8 h-8 drop-shadow-[0_0_12px_rgba(128,156,255,0.6)]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">TeleGallery Storage</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Unlimited Cloud Media Vault · Zero Subscription Fees
          </p>

          {/* Stepper Dots */}
          <div className="flex items-center gap-2 mt-6">
            {(["need_credentials", "need_phone", "need_code", "need_vault", "ready"] as AuthStep[]).map((s, idx) => {
              const isActive = step === s || (step === "need_password" && s === "need_code");
              return (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    isActive
                      ? "w-8 bg-primary shadow-[0_0_8px_rgba(128,156,255,0.7)]"
                      : "w-2 bg-surface-container-high"
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-6 p-4 rounded-neo bg-error-container/20 border border-error/30 text-error flex items-start gap-3 text-sm"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stepped Views */}
        <AnimatePresence mode="wait">
          {/* STEP 1: API CREDENTIALS */}
          {step === "need_credentials" && (
            <motion.form
              key="credentials"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleSaveCredentials}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  Telegram MTProto Setup
                </h2>
                <p className="text-xs text-on-surface-variant mt-1">
                  Connect TeleGallery to Telegram's secure cloud storage protocol.
                </p>
              </div>

              {/* Toggle Preset vs Custom */}
              <div className="p-4 rounded-neo bg-surface-container neo-pressed space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useDefaultCredentials}
                    onChange={(e) => setUseDefaultCredentials(e.target.checked)}
                    className="w-4 h-4 rounded text-primary focus:ring-0 bg-surface-base"
                  />
                  <span className="text-sm font-medium text-on-surface">
                    Use Standard Public Telegram Desktop Credentials
                  </span>
                </label>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Recommended for instant plug-and-play. No manual app registration required.
                </p>
              </div>

              {!useDefaultCredentials && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">
                      Telegram API ID
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 1234567"
                      value={apiId}
                      onChange={(e) => setApiId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-neo bg-surface-container neo-pressed text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">
                      Telegram API Hash
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 0123456789abcdef0123456789abcdef"
                      value={apiHash}
                      onChange={(e) => setApiHash(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-neo bg-surface-container neo-pressed text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono text-xs"
                    />
                  </div>
                  <a
                    href="https://my.telegram.org/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <span>Get your API credentials at my.telegram.org</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-neo neo-button-primary font-semibold text-sm flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4" /></>}
              </button>
            </motion.form>
          )}

          {/* STEP 2: PHONE NUMBER */}
          {step === "need_phone" && (
            <motion.form
              key="phone"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleSendCode}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
                  <Phone className="w-5 h-5 text-primary" />
                  Enter Phone Number
                </h2>
                <p className="text-xs text-on-surface-variant mt-1">
                  Telegram will deliver an official login code to your active Telegram sessions.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  Mobile Number (with country code)
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="+62 812 3456 7890"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    autoFocus
                    className="w-full px-4 py-3 rounded-neo bg-surface-container neo-pressed text-on-surface text-base tracking-wide focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
                <p className="text-xs text-on-surface-variant mt-2">
                  Example: <code className="text-primary">+6281234567890</code> or <code className="text-primary">+12025550143</code>
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep("need_credentials")}
                  className="px-4 py-3 rounded-neo neo-button text-on-surface-variant text-sm flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 px-4 rounded-neo neo-button-primary font-semibold text-sm flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Send Login Code <ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </motion.form>
          )}

          {/* STEP 3: OTP VERIFICATION CODE */}
          {step === "need_code" && (
            <motion.form
              key="code"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleVerifyCode}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" />
                  Verify Login Code
                </h2>
                <p className="text-xs text-on-surface-variant mt-1">
                  We've sent a 5-digit verification code to your Telegram app for <span className="text-primary font-medium">{phoneNumber}</span>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  5-Digit Code
                </label>
                <input
                  type="text"
                  maxLength={5}
                  placeholder="12345"
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  className="w-full px-4 py-3 rounded-neo bg-surface-container neo-pressed text-center text-2xl tracking-[0.6em] font-mono text-primary font-bold focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <button
                  type="button"
                  onClick={() => setStep("need_phone")}
                  className="hover:text-on-surface underline"
                >
                  Change phone number
                </button>
                {resendCountdown > 0 ? (
                  <span>Resend in {resendCountdown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendCode}
                    className="text-primary hover:underline font-medium"
                  >
                    Resend Code
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || phoneCode.length < 5}
                className="w-full py-3 px-4 rounded-neo neo-button-primary font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Verify Code <ArrowRight className="w-4 h-4" /></>}
              </button>
            </motion.form>
          )}

          {/* STEP 4: 2FA CLOUD PASSWORD */}
          {step === "need_password" && (
            <motion.form
              key="password"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleVerifyPassword}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
                  <Lock className="w-5 h-5 text-primary" />
                  Two-Step Verification
                </h2>
                <p className="text-xs text-on-surface-variant mt-1">
                  Your Telegram account is protected by an additional cloud password.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  Telegram Cloud Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your 2FA password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    className="w-full px-4 py-3 rounded-neo bg-surface-container neo-pressed text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full py-3 px-4 rounded-neo neo-button-primary font-semibold text-sm flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Unlock Vault <ArrowRight className="w-4 h-4" /></>}
              </button>
            </motion.form>
          )}

          {/* STEP 5: VAULT SELECTION / CREATION */}
          {step === "need_vault" && (
            <motion.div
              key="vault"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-lg font-semibold text-on-surface flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-primary" />
                  Select or Create Media Vault
                </h2>
                <p className="text-xs text-on-surface-variant mt-1">
                  {userProfile
                    ? `Welcome, ${userProfile.first_name}! Let's set up your private media storage vault.`
                    : "Configure a private storage channel for your media archive."}
                </p>
              </div>

              {/* 1-Click Vault Creation */}
              <form onSubmit={handleCreateVault} className="p-4 rounded-neo bg-surface-container space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Option 1: Create New Private Vault
                </span>
                <input
                  type="text"
                  placeholder="Vault Channel Title"
                  value={vaultTitle}
                  onChange={(e) => setVaultTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-neo bg-surface-base neo-pressed text-on-surface text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-neo neo-button-primary font-medium text-xs flex items-center justify-center gap-2"
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Create & Connect Vault"}
                </button>
              </form>

              {/* Existing Channels Selection */}
              {availableVaults.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                    Option 2: Use Existing Owned Channel
                  </span>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {availableVaults.map((vault) => (
                      <button
                        key={vault.id}
                        type="button"
                        onClick={() => handleSelectExistingVault(vault)}
                        disabled={loading}
                        className="w-full p-2.5 rounded-neo bg-surface-container hover:bg-surface-container-high text-left flex items-center justify-between transition-colors"
                      >
                        <span className="text-xs font-medium text-on-surface truncate">{vault.title}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                          Connect
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 6: READY */}
          {step === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 py-4"
            >
              <div className="w-16 h-16 rounded-full neo-raised mx-auto flex items-center justify-center text-primary bg-surface-base">
                <CheckCircle2 className="w-10 h-10 text-primary drop-shadow-[0_0_12px_rgba(128,156,255,0.8)]" />
              </div>

              <div>
                <h2 className="text-xl font-bold text-on-surface">You're All Set!</h2>
                <p className="text-sm text-on-surface-variant mt-1.5 max-w-sm mx-auto">
                  Connected to{" "}
                  <span className="text-primary font-semibold">
                    {createdChannelInfo?.title || initialStatus.active_vault?.title || "Telegram Cloud Vault"}
                  </span>
                  . Your unlimited media archive is ready.
                </p>
              </div>

              <div className="p-4 rounded-neo bg-surface-container text-left text-xs space-y-2 neo-pressed">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Authenticated User:</span>
                  <span className="text-on-surface font-medium">
                    {userProfile ? `${userProfile.first_name} ${userProfile.last_name || ""}` : "Telegram User"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Storage Architecture:</span>
                  <span className="text-on-surface font-medium">Telegram MTProto + TDLib C++</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Storage Cost:</span>
                  <span className="text-primary font-semibold">$0 / Month (Unlimited)</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleFinishOnboarding}
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-neo neo-button-primary font-bold text-sm shadow-lg flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Launch TeleGallery <ArrowRight className="w-4 h-4" /></>}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
